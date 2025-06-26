"""
기존 버전에선 데이터 전송 실패시 마지막으로 수신된 데이터로 재전송 시도했던 부분을
실패시 while 문을 탈출하지 않았던 부분 제거하여 수정하여 개선
"""

import serial
import datetime
import pytz
import requests
import json
import time
import subprocess
import os

# 시리얼 포트 설정
serial_port = "/dev/ttyACM0"
baud_rate = 115200

max_retry = 10  # 최대 재시도 횟수
retry_delay = 10  # 재시도 간격 (초)

def get_current_ssid():
    try:
        ssid = subprocess.check_output(["iwgetid", "-r"]).decode().strip()
        return ssid
    except subprocess.CalledProcessError:
        return None

# 현재 접속한 SSID 확인
current_ssid = get_current_ssid()

# SSID에 따라 URL 설정
if current_ssid == "JH_hotspot":
    django_server_url = "http://192.168.66.236:8000/hardware/pull/"  # 지훈씨 핫스팟
elif current_ssid == "CCIT_2023_5G":
    django_server_url = "http://192.168.0.146:8000/hardware/pull/"   # CCIT 와이파이
elif current_ssid == "CCIT_2023":
    django_server_url = "http://192.168.0.146:8000/hardware/pull/"   # CCIT 와이파이
else:
    print("[ERROR] 네트워크에 연결되지 않았습니다. 10초 후 라즈베리파이를 재부팅합니다.")
    time.sleep(10)

    
try:
    ser = serial.Serial(serial_port, baud_rate, timeout=3)
    print(f"Serial port {serial_port} opened successfully")
except serial.SerialException as e:
    print(f"Error opening serial port {serial_port}: {e}")
    exit()

try:
    while True:
        if ser.in_waiting > 0:
            data = ser.readline().decode('utf-8').strip()
            if data:
                try:
                    parts = data.split(',')
                    if len(parts) == 7:
                        time_str, lat_str, lon_str, speed_str, course_str = parts[:3], parts[3], parts[4], parts[5], parts[6]
                        hour_utc, minute_utc, second_utc = time_str
                        latitude = float(lat_str)
                        longitude = float(lon_str)
                        speed_knots = float(speed_str)
                        course_degrees = float(course_str)

                        # UTC 시간 정보 datetime 객체로 생성
                        utc_time = datetime.datetime(2025, 3, 18, int(hour_utc), int(minute_utc), int(second_utc), tzinfo=pytz.utc)  # 날짜는 예시 (실제 날짜 정보 필요 시 NMEA 문장에서 파싱)

                        # UTC -> KST 변환
                        kst_timezone = pytz.timezone('Asia/Seoul')
                        kst_time = utc_time.astimezone(kst_timezone)

                        # Django 서버로 전송할 데이터 생성
                        gps_data = {
                            "kst_time": kst_time.strftime("%Y-%m-%d %H:%M:%S"),  # ISO 8601 형식으로 변경
                            "lat_lon": f"{latitude},{longitude}",  # 위도, 경도 문자열로 결합
                            "speed": speed_knots,
                            "course": course_degrees,
                        }

                        # Django 서버로 POST 요청 전송
                        try:
                            response = requests.post(django_server_url, data=json.dumps(gps_data), headers={'Content-Type': 'application/json'})
                            if response.status_code == 201 or response.status_code == 200:
                                print("----------Successfully to sent data----------")
                                print("KST 시간: {}".format(kst_time.strftime("%H:%M:%S")))  # KST 시간 (HH:MM:SS 형식)
                                print("위도: {:.5f}".format(latitude))
                                print("경도: {:.5f}".format(longitude))
                                print("속도: {:.2f} km/h".format(speed_knots))  # 속도 (노트)
                                print("방향: {:.2f} degrees".format(course_degrees))  # 방향 (각도)
                            else:
                                print(f"Failed to send data: {response.status_code}, {response.text}")
                                print("----------Failed to sent data----------")
                                print("KST 시간: {}".format(kst_time.strftime("%H:%M:%S")))  # KST 시간 (HH:MM:SS 형식)
                                print("위도: {:.5f}".format(latitude))
                                print("경도: {:.5f}".format(longitude))
                                print("속도: {:.2f} km/h".format(speed_knots))  # 속도 (노트)
                                print("방향: {:.2f} degrees".format(course_degrees))  # 방향 (각도)

                        except requests.exceptions.RequestException as e:
                            print(f"Request Exception: {e}")

                    else:
                        print(f"Invalid data format (wrong number of parts): {data}")  # 7개가 아닐경우 출력만 진행.

                except ValueError as e:
                    print(f"ValueError during parsing: {e}, Data: {data}")

except KeyboardInterrupt:
    print("Exiting program")
finally:
    if ser.is_open:
        ser.close()
        print(f"Serial port {serial_port} closed")