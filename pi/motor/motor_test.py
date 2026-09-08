from gpiozero import PWMOutputDevice, DigitalOutputDevice
from time import sleep

# BCM GPIO 번호
A_EN = PWMOutputDevice(18, frequency=1000, initial_value=0)
A_PH = DigitalOutputDevice(23, initial_value=False)

B_EN = PWMOutputDevice(19, frequency=1000, initial_value=0)
B_PH = DigitalOutputDevice(24, initial_value=False)


def motor_a(speed: float) -> None:
    """
    Motor A control
    speed: -1.0 ~ 1.0
    양수와 음수는 서로 반대 방향
    """
    speed = max(-1.0, min(1.0, speed))

    if speed >= 0:
        A_PH.off()
        A_EN.value = speed
    else:
        A_PH.on()
        A_EN.value = -speed


def motor_b(speed: float) -> None:
    """
    Motor B control
    speed: -1.0 ~ 1.0
    """
    speed = max(-1.0, min(1.0, speed))

    if speed >= 0:
        B_PH.off()
        B_EN.value = speed
    else:
        B_PH.on()
        B_EN.value = -speed


def stop() -> None:
    A_EN.value = 0
    B_EN.value = 0


try:
    print("Motor A forward")
    motor_a(0.9)
    sleep(2)
    stop()
    sleep(1)

    print("Motor A reverse")
    motor_a(-0.9)
    sleep(2)
    stop()
    sleep(1)

    print("Motor B forward")
    motor_b(0.6)
    sleep(2)
    stop()
    sleep(1)

    print("Motor B reverse")
    motor_b(-0.6)
    sleep(2)
    stop()

finally:
    stop()
    A_EN.close()
    A_PH.close()
    B_EN.close()
    B_PH.close()