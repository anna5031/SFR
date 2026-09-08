#!/usr/bin/env python3
"""LAN WebSocket server for the SFR two-motor control board."""

import argparse
import asyncio
import json
import signal
from contextlib import suppress
from typing import Optional

from gpiozero import DigitalOutputDevice, PWMOutputDevice
import websockets


class MotorDriver:
    def __init__(self) -> None:
        self._enable = {
            "a": PWMOutputDevice(18, frequency=1000, initial_value=0),
            "b": PWMOutputDevice(19, frequency=1000, initial_value=0),
        }
        self._phase = {
            "a": DigitalOutputDevice(23, initial_value=False),
            "b": DigitalOutputDevice(24, initial_value=False),
        }

    def set(self, motor: str, direction: str, speed: float) -> None:
        if motor not in self._enable:
            raise ValueError("invalid_motor")
        if direction not in {"forward", "backward"}:
            raise ValueError("invalid_direction")

        self._phase[motor].value = direction == "backward"
        self._enable[motor].value = speed

    def stop(self, motor: str) -> None:
        if motor not in self._enable:
            raise ValueError("invalid_motor")
        self._enable[motor].value = 0

    def stop_all(self) -> None:
        for motor in self._enable:
            self.stop(motor)

    def close(self) -> None:
        self.stop_all()
        for device in (*self._enable.values(), *self._phase.values()):
            device.close()


class MotorController:
    def __init__(self, driver: MotorDriver, auto_interval: float) -> None:
        self.driver = driver
        self.motor_speed = {"a": 0.9, "b": 0.6}
        self.auto_interval = auto_interval
        self.manual_direction = {"a": None, "b": None}
        self.auto_task: Optional[asyncio.Task] = None
        self.auto_direction: Optional[str] = None
        self.auto_fixed_direction: Optional[str] = None

    def set_auto_interval(self, interval: object) -> None:
        try:
            parsed = float(interval)
        except (TypeError, ValueError) as exc:
            raise ValueError("invalid_auto_interval") from exc
        if not 0.25 <= parsed <= 5:
            raise ValueError("invalid_auto_interval")
        self.auto_interval = parsed

    async def manual(self, motor: str, direction: str) -> None:
        if motor == "a":
            await self.stop_auto()
        self.driver.stop(motor)
        self.manual_direction[motor] = direction
        self.driver.set(motor, direction, self.motor_speed[motor])

    def stop(self, motor: str) -> None:
        self.driver.stop(motor)
        self.manual_direction[motor] = None

    async def start_auto(self, fixed_direction: Optional[str] = None) -> None:
        if fixed_direction not in {None, "forward", "backward"}:
            raise ValueError("invalid_direction")
        if (
            self.auto_task is not None
            and not self.auto_task.done()
            and self.auto_fixed_direction == fixed_direction
        ):
            return
        await self.stop_auto()
        self.stop("a")
        self.auto_fixed_direction = fixed_direction
        self.auto_task = asyncio.create_task(self._auto_loop(fixed_direction))

    async def stop_auto(self) -> None:
        task = self.auto_task
        self.auto_task = None
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        self.auto_direction = None
        self.auto_fixed_direction = None
        self.driver.stop("a")

    async def _auto_loop(self, fixed_direction: Optional[str]) -> None:
        direction = fixed_direction or "forward"
        try:
            while True:
                self.auto_direction = direction
                self.driver.set("a", direction, self.motor_speed["a"])
                await asyncio.sleep(self.auto_interval)
                self.driver.stop("a")
                await asyncio.sleep(0.15)
                if fixed_direction is None:
                    direction = "backward" if direction == "forward" else "forward"
        finally:
            self.auto_direction = None
            self.driver.stop("a")

    async def stop_all(self) -> None:
        await self.stop_auto()
        self.manual_direction = {"a": None, "b": None}
        self.driver.stop_all()

    async def execute_command(self, command: object) -> None:
        """Execute one of the high-level commands sent by the Unity client."""
        if command == "go":
            await self.start_auto()
            self.stop("b")
        elif command == "left":
            await self.start_auto("forward")
            self.stop("b")
        elif command == "right":
            await self.start_auto("backward")
            self.stop("b")
        elif command == "goup":
            await self.start_auto()
            await self.manual("b", "forward")
        elif command == "godown":
            await self.start_auto()
            await self.manual("b", "backward")
        elif command == "up":
            await self.stop_auto()
            await self.manual("b", "forward")
        elif command == "down":
            await self.stop_auto()
            await self.manual("b", "backward")
        elif command == "stop":
            await self.stop_all()
        else:
            raise ValueError("invalid_command")


async def run_server(host: str, port: int, auto_interval: float) -> None:
    driver = MotorDriver()
    controller = MotorController(driver, auto_interval)
    shutdown = asyncio.Event()

    async def handler(websocket, *_args) -> None:
        print(f"Control board connected: {websocket.remote_address}")
        try:
            async for raw_message in websocket:
                try:
                    message = json.loads(raw_message)
                    message_type = message.get("type")

                    if message_type == "command":
                        await controller.execute_command(message.get("command"))
                    elif message_type == "motor":
                        await controller.manual(message.get("motor"), message.get("direction"))
                    elif message_type == "stop":
                        controller.stop(message.get("motor"))
                    elif message_type == "auto_interval":
                        controller.set_auto_interval(message.get("seconds"))
                    elif message_type == "auto":
                        if message.get("enabled") is True:
                            await controller.start_auto()
                        else:
                            await controller.stop_auto()
                    elif message_type == "emergency_stop":
                        await controller.stop_all()
                    else:
                        raise ValueError("invalid_command")

                    await websocket.send(json.dumps({"type": "ack", "command": message_type}))
                except (json.JSONDecodeError, ValueError) as exc:
                    await websocket.send(json.dumps({"type": "error", "error": str(exc)}))
        finally:
            await controller.stop_all()
            print("Control board disconnected; all motors stopped")

    loop = asyncio.get_running_loop()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        with suppress(NotImplementedError):
            loop.add_signal_handler(signal_name, shutdown.set)

    try:
        async with websockets.serve(handler, host, port):
            print(f"Motor server listening on ws://{host}:{port}")
            await shutdown.wait()
    finally:
        await controller.stop_all()
        driver.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="SFR motor WebSocket server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--auto-interval", type=float, default=0.5)
    args = parser.parse_args()
    asyncio.run(run_server(args.host, args.port, args.auto_interval))


if __name__ == "__main__":
    main()
