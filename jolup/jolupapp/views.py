import cv2
from django.shortcuts import render
from django.http import StreamingHttpResponse
import os, requests, xmltodict
import ssl
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
# Create your views here.
from .serializers import (
    UsersSerializer, MasterSerializer, UserHistorySerializer, RoadReportSerializer,
    SubsidenceReportSerializer
)
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from .models import Users, Master, UserHistory, RoadReport, SubsidenceReport, GGSubsidenceReport
from django.http import JsonResponse
import pytz
from datetime import datetime
from django.conf import settings
import torch
import numpy as np
from pathlib import Path
from ultralytics import YOLO
from functools import lru_cache
from math import radians, cos, sin, asin, sqrt
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from urllib.parse import unquote, urlencode
from django.db import connection
import pandas as pd
import time
from django.core.exceptions import ValidationError
from django.utils.crypto import constant_time_compare
import logging
import pathlib #이 세줄이 욜로 리눅스 문제일때때
temp = pathlib.PosixPath 
pathlib.PosixPath = pathlib.WindowsPath


load_dotenv()  # .env 파일에서 환경변수 로드
def index(request):  # 임시 메인페이지 출력문
    return JsonResponse({"message": "Django 서버가 정상적으로 동작 중입니다."})


# Users ViewSet
class UsersViewSet(viewsets.ModelViewSet):
    queryset = Users.objects.all()  # 모든 유저 데이터 가져오기
    serializer_class = UsersSerializer

# Master ViewSet


class MasterViewSet(viewsets.ModelViewSet):
    queryset = Master.objects.all()
    serializer_class = MasterSerializer


# UserHistory ViewSet
class UserHistoryViewSet(viewsets.ModelViewSet):
    queryset = UserHistory.objects.all()
    serializer_class = UserHistorySerializer


# RoadReport ViewSet
class RoadReportViewSet(viewsets.ModelViewSet):
    queryset = RoadReport.objects.all()
    serializer_class = RoadReportSerializer


# 관리자 회원가입 API
class MasterSignUp(APIView):
    def post(self, request):
        serializer = MasterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(master_pw=make_password(serializer.validated_data['master_pw']))
            return Response({'message': '관리자 등록 성공'}, status=status.HTTP_201_CREATED)
        return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# 관리자 로그인 API
class MasterLogin(APIView):
    # JSON / form-urlencoded / multipart 모두 허용
    parser_classes = (JSONParser, FormParser, MultiPartParser)

    def post(self, request):
        master_id = (request.data.get('master_id') or '').strip()
        master_pw = (request.data.get('master_pw') or '').strip()

        if not master_id or not master_pw:
            return Response({'error': 'master_id와 master_pw는 필수입니다.'},
                            status=status.HTTP_400_BAD_REQUEST)

        master = Master.objects.filter(master_id=master_id).first()
        if not master:
            return Response({'error': '관리자 계정이 존재하지 않습니다.'},
                            status=status.HTTP_404_NOT_FOUND)

        if not check_password(master_pw, master.master_pw):
            return Response({'error': '비밀번호가 틀렸습니다.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        # TODO: JWT/세션 발급
        return Response({'message': '관리자 로그인 성공'}, status=status.HTTP_200_OK)


# 사용자 회원가입 API
class UserSignUp(APIView):
    def post(self, request):
        serializer = UsersSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user_pw=make_password(serializer.validated_data['user_pw']))
            return Response({'message': '회원가입 성공'}, status=status.HTTP_201_CREATED)
        return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

logger = logging.getLogger(__name__)
# 사용자 로그인 API
class UserLogin(APIView):
    # JSON / form-urlencoded / multipart 모두 허용 (프론트 타입 불일치 대비)
    parser_classes = (JSONParser, FormParser, MultiPartParser)

    def post(self, request):
        user_id = (request.data.get('user_id') or '').strip()
        user_pw = (request.data.get('user_pw') or '').strip()

        if not user_id or not user_pw:
            return Response({'error': 'user_id와 user_pw는 필수입니다.'},
                            status=status.HTTP_400_BAD_REQUEST)

        user = Users.objects.filter(user_id=user_id).first()
        if not user:
            logger.info(f"[LOGIN] user not found user_id={user_id}")
            return Response({'error': '사용자 계정이 존재하지 않습니다.'},
                            status=status.HTTP_404_NOT_FOUND)

        # 비밀번호 검증
        if not check_password(user_pw, user.user_pw):
            logger.info(
                f"[LOGIN] password mismatch user_id={user_id} "
                f"ctype={request.content_type}"
            )
            return Response({'error': '비밀번호가 틀렸습니다.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        # TODO: 필요시 JWT/세션 발급 추가
        return Response({'message': '사용자 로그인 성공'}, status=status.HTTP_200_OK)

# 사용자 로그아웃 API
class UserSignOut(APIView):
    def post(self, request):
        return Response({'message': '로그아웃 성공'}, status=status.HTTP_200_OK)


# 사용자 정보 조회 API
class UserInfo(APIView):
    def get(self, request, user_id):  # URL 패턴에서 user_id를 받음
        user = get_object_or_404(Users, user_id=user_id)
        serializer = UsersSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

# 사용자 정보 수정 API
class UserUpdate(APIView):
    def put(self, request, user_id):
        user = get_object_or_404(Users, user_id=user_id)
        
        data = request.data

        # 수정 가능한 필드만 업데이트
        if 'user_name' in data:
            user.user_name = data['user_name']
        if 'user_age' in data:
            user.user_age = data['user_age']
        if 'user_phonenumber' in data:
            user.user_phonenumber = data['user_phonenumber']

        user.save()
        return Response({'message': '사용자 정보 수정 완료'}, status=status.HTTP_200_OK)
# 사용자 비밀번호 수정 API
class UserPasswordChange(APIView):
    def put(self, request, user_id):
        user = get_object_or_404(Users, user_id=user_id)
        
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response({'error': '현재 비밀번호와 새 비밀번호를 입력하세요.'}, status=status.HTTP_400_BAD_REQUEST)

        if not check_password(current_password, user.user_pw):
            return Response({'error': '현재 비밀번호가 일치하지 않습니다.'}, status=status.HTTP_401_UNAUTHORIZED)

        user.user_pw = make_password(new_password)
        user.save()

        return Response({'message': '비밀번호 변경 완료'}, status=status.HTTP_200_OK)

# 도로 보고 전체 조회 API
class RoadReportAll(APIView):
    def get(self, request):
        reports = RoadReport.objects.exclude(roadreport_image__isnull=True).exclude(roadreport_image__exact="")
        serializer = RoadReportSerializer(reports, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# 특정 도로 보고 조회 API
# class RoadReportSelect(APIView):
#   def get(self, request, roadreport_latlng):
#      report = get_object_or_404(RoadReport, roadreport_latlng=roadreport_latlng)
#     serializer = RoadReportSerializer(report)
#
#     return Response(serializer.data, status=status.HTTP_200_OK)
class RoadReportSelect(APIView):
    def get(self, request, roadreport_num):
        # roadreport_num이이 정확히 일치하는 데이터 조회
        report = RoadReport.objects.filter(roadreport_num=roadreport_num).first()

        if not report:
            return Response({'error': '해당 roadreport_num가 존재하지 않습니다.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RoadReportSerializer(report)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # 도로 보고 삭제 API
class RoadReportDelete(APIView):
    def delete(self, request, roadreport_num):
        report = get_object_or_404(RoadReport, roadreport_num=roadreport_num)
        report.delete()
        return Response({'message': '도로 보고 삭제 완료'}, status=status.HTTP_204_NO_CONTENT)


# 도로 보고 수정 API
"""
class RoadReportEdit(APIView):
    def put(self, request, roadreport_num):
        report = get_object_or_404(RoadReport, roadreport_num=roadreport_num)
        serializer = RoadReportSerializer(report, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': '도로 보고 수정 완료'}, status=status.HTTP_200_OK)
        return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
"""
class RoadReportEdit(APIView):
    def put(self, request, roadreport_num):
        report = get_object_or_404(RoadReport, roadreport_num=roadreport_num)
        
        # 요청 데이터에서 roadreport_status만 받음
        roadreport_status = request.data.get('roadreport_status')
        
        if roadreport_status not in ['접수됨', '처리중', '해결됨', '보류중']:
            return Response({'error': '유효하지 않은 상태입니다.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 상태만 수정
        report.roadreport_status = roadreport_status
        report.save()
        
        return Response({'message': '도로 보고 상태 수정 완료'}, status=status.HTTP_200_OK)
# YOLOv8 모델 로딩 함수
def load_yolo_model():
    print("[INFO] YOLO 모델 로드 중 (force reload)")
    return YOLO("C:/Users/ysyhs/Desktop/jolup/models/yoloV8v5.pt")

# ✅ Haversine 거리 계산 함수 (반경 5m 이내 판별용)
def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # 지구 반지름(m)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * 2 * asin(sqrt(a))
"""
class HardwarePull(APIView):
    def post(self, request):
        try:
            print("[INFO] 요청 수신됨. 모델 로드 시작.")
            model = load_yolo_model()
            print("[INFO] 모델 로딩 완료.")

            # 시간 및 파일명 설정
            kst = pytz.timezone('Asia/Seoul')
            kst_time = datetime.now(kst)
            filename = kst_time.strftime('%Y%m%d_%H%M%S') + '.jpg'

            save_dir = os.path.join(settings.MEDIA_ROOT, 'reports')
            os.makedirs(save_dir, exist_ok=True)
            save_path = os.path.join(save_dir, filename)

            # 영상 캡처
            cap = cv2.VideoCapture("http://192.168.0.135:8081/")
            #cap = cv2.VideoCapture("http://192.168.66.194:8081/")
            print(f"[DEBUG] VideoCapture opened: {cap.isOpened()}")
            ret, frame = cap.read()
            cap.release()

            if not ret or frame is None:
                return Response({"error": "카메라 캡처 실패"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # 요청 데이터
            lat_lon = request.data.get("lat_lon", "")
            speed = request.data.get("speed", None)
            direction = request.data.get("course", None)

            try:
                curr_lat, curr_lon = map(float, lat_lon.split(','))
            except:
                return Response({"error": "잘못된 좌표 형식"}, status=status.HTTP_400_BAD_REQUEST)

            # 최근 보고된 이미지 좌표 비교
            latest = RoadReport.objects.filter(roadreport_image__isnull=False).order_by('-roadreport_time').first()
            if latest and latest.roadreport_latlng:
                try:
                    prev_lat, prev_lon = map(float, latest.roadreport_latlng.split(','))
                    if abs(curr_lat - prev_lat) < 0.00005 and abs(curr_lon - prev_lon) < 0.00006:
                        print("[INFO] 최근 위치와 유사 → 저장 생략")
                        return Response({"message": "중복 위치로 이미지 저장 생략"}, status=status.HTTP_200_OK)
                except:
                    pass

            # 객체 탐지
            results = model.predict(frame, conf=0.3)[0]
            detections = results.boxes
            print(f"[INFO] 감지된 객체 수: {len(detections)}")

            image_path = None
            detected_types = set()

            if detections is not None and detections.xyxy.shape[0] > 0:
                for xyxy, conf, cls in zip(detections.xyxy, detections.conf, detections.cls):
                    if conf < 0.67:
                        continue
                    class_name = model.names[int(cls)].lower()
                    if class_name in ["crack", "pothole"]:
                        detected_types.add(class_name)
                        x1, y1, x2, y2 = map(int, xyxy)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(frame, class_name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                        image_path = os.path.join('reports', filename)

            # 이미지 저장
            if image_path:
                cv2.imwrite(save_path, frame)
                print(f"[INFO] 이미지 저장됨: {save_path}")

            damage_str = ", ".join(sorted(detected_types)) if detected_types else None

            # DB 저장
            RoadReport.objects.create(
                roadreport_time=kst_time,
                roadreport_image=image_path,
                roadreport_latlng=lat_lon,
                roadreport_speed=speed,
                roadreport_direction=direction,
                roadreport_damagetype=damage_str
            )
            print("[INFO] DB 저장 완료.")

            if image_path:
                return Response({"message": "감지됨, 이미지 저장 완료", "file": filename}, status=status.HTTP_201_CREATED)
            else:
                return Response({"message": "감지 안됨, 정보만 저장됨"}, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"[ERROR] 예외 발생: {str(e)}")
            return Response({"error": f"오류 발생: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
"""


# 하드웨어에서 영상 받아 객체 감지 및 중복 검사
class HardwarePull(APIView):
    def post(self, request):
        try:
            print("[INFO] 요청 수신됨. 모델 로드 시작.")
            model = YOLO("C:/Users/ysyhs/Desktop/jolup/models/yoloV8v5.pt")
            print("[INFO] 모델 로딩 완료.")

            # 시간 및 파일 경로 설정
            kst = pytz.timezone('Asia/Seoul')
            kst_time = datetime.now(kst)
            filename = kst_time.strftime('%Y%m%d_%H%M%S') + '.jpg'
            save_dir = os.path.join(settings.MEDIA_ROOT, 'reports')
            os.makedirs(save_dir, exist_ok=True)
            save_path = os.path.join(save_dir, filename)

            # 영상 캡처
            cap = cv2.VideoCapture("http://192.168.0.135:8081/")
            print(f"[DEBUG] VideoCapture opened: {cap.isOpened()}")
            ret, frame = cap.read()
            cap.release()
            if not ret or frame is None:
                return Response({"error": "카메라 캡처 실패"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # 요청 데이터 받기
            lat_lon = request.data.get("lat_lon", "")
            speed = request.data.get("speed", None)
            direction = request.data.get("course", None)
            try:
                curr_lat, curr_lon = map(float, lat_lon.split(','))
            except:
                return Response({"error": "잘못된 좌표 형식"}, status=status.HTTP_400_BAD_REQUEST)

            # 객체 탐지 수행
            results = model.predict(frame, conf=0.7)[0]
            detections = results.boxes
            print(f"[INFO] 감지된 객체 수: {len(detections)}")

            image_path = None
            detected_types = set()
            target_class = None

            # 유효 객체 탐지: pothole 또는 crack만 수집
            if detections is not None and detections.xyxy.shape[0] > 0:
                for xyxy, conf, cls in zip(detections.xyxy, detections.conf, detections.cls):
                    class_name = model.names[int(cls)].lower()

                    # 클래스별 임계값 설정
                    if class_name == "pothole" and conf < 0.8:
                        continue
                    if class_name == "crack" and conf < 0.7:
                        continue
                    if class_name not in ["pothole", "crack"]:
                        continue

                    # 바운딩 박스 색상 지정
                    if class_name == "pothole":
                        box_color = (0, 0, 255)  # 빨강
                    elif class_name == "crack":
                        box_color = (255, 0, 0)  # 파랑

                    x1, y1, x2, y2 = map(int, xyxy)
                    label = f"{class_name} {conf:.2f}"

                    # 실제 그리기
                    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                    cv2.putText(frame, label, (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

                    # 기록용
                    detected_types.add(class_name)
                    target_class = class_name
                    image_path = os.path.join('reports', filename)

            # 이미지 저장
            if image_path:
                cv2.imwrite(save_path, frame)
                print(f"[INFO] 이미지 저장됨: {save_path}")

            damage_str = ", ".join(sorted(detected_types)) if detected_types else None

            # 동일 클래스 + 반경 5m 이내 신고 개수 계산
            count = 0
            if target_class:
                similar_reports = RoadReport.objects.filter(
                    roadreport_damagetype=target_class,
                    roadreport_latlng__isnull=False
                )
                for report in similar_reports:
                    try:
                        rep_lat, rep_lon = map(float, report.roadreport_latlng.split(','))
                        if haversine(curr_lat, curr_lon, rep_lat, rep_lon) <= 5:
                            count += 1
                    except:
                        continue

            # 3건까지는 저장 허용, 4건 이상이면 거부
            #if count >= 3:
                #return Response({"message": f"{target_class} 중복 3건 초과로 저장 차단"}, status=200)

            # DB 저장 (roadreport_count = count + 1)
            RoadReport.objects.create(
                roadreport_time=kst_time,
                roadreport_image=image_path,
                roadreport_latlng=lat_lon,
                roadreport_speed=speed,
                roadreport_direction=direction,
                roadreport_damagetype=target_class,
                roadreport_count=count + 1
            )
            print("[INFO] DB 저장 완료.")

            return Response({"message": "신고 저장 완료", "file": filename}, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"[ERROR] 예외 발생: {str(e)}")
            return Response({"error": f"오류 발생: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def object_detection_stream(request):
    stream_url = "http://192.168.0.135:8081/"
    #stream_url = "http://192.168.66.194:8081/"
    model = load_yolo_model()
    names = model.model.names  # YOLOv8 클래스 이름 접근

    def generate_frames():
        cap = cv2.VideoCapture(stream_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not cap.isOpened():
            print("[ERROR] 스트림 열기 실패")
            return

        frame_count = 0
        detections = []

        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                time.sleep(0.2)
                continue

            frame_count += 1

            # YOLO 추론 (3프레임마다, 로그 숨김)
            if frame_count % 3 == 0:
                results = model.predict(source=frame, conf=0.5, verbose=False)[0]
                detections = results.boxes.data.cpu().numpy().tolist()

            # 감지된 객체 표시
            if detections:
                for *xyxy, conf, cls in detections:
                    if len(xyxy) != 4 or conf < 0.5:
                        continue
                    x1, y1, x2, y2 = map(int, xyxy)
                    class_name = names[int(cls)]
                    label = f"{class_name} {conf:.2f}"

                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX,
                                0.6, (0, 255, 0), 2)

            _, jpeg = cv2.imencode('.jpg', frame)
            if jpeg is None:
                continue

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')

        cap.release()

    return StreamingHttpResponse(generate_frames(), content_type='multipart/x-mixed-replace; boundary=frame')





# AI 데이터 요청 API
class AiPull(APIView):
    def get(self, request):
        return Response({'message': 'AI 데이터 조회'}, status=status.HTTP_200_OK)


# 도로 보고 이미지 업로드 API
class RoadReportImageUpload(APIView):
    def post(self, request, report_id):
        report = get_object_or_404(RoadReport, roadreport_latlng=report_id)
        if 'roadreport_image' in request.FILES:
            report.roadreport_image = request.FILES['roadreport_image']
            report.save()
            return Response({'message': '이미지 업로드 성공'}, status=status.HTTP_200_OK)
        return Response({'error': '파일이 없습니다.'}, status=status.HTTP_400_BAD_REQUEST)


# 위도 경도 분리시키는 api
class RoadReportSelectWithCoords(APIView):
    def get(self, request, report_id):
        """ 도로 보고 데이터를 가져올 때 위도/경도를 분리하여 응답 """
        try:
            report = get_object_or_404(RoadReport, roadreport_latlng=report_id)

            # 예외 처리: roadreport_latlng가 None이거나 올바른 형식이 아닌 경우
            if not report.roadreport_latlng or ',' not in report.roadreport_latlng:
                return Response({'error': '잘못된 위치 데이터입니다.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                latitude, longitude = map(float, report.roadreport_latlng.split(','))  # 실수형 변환
            except ValueError:
                return Response({'error': '위도/경도 값이 올바르지 않습니다.'}, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'roadreport_latlng': report.roadreport_latlng,
                'latitude': latitude,
                'longitude': longitude,
                'roadreport_damagetype': report.roadreport_damagetype,
                'roadreport_status': report.roadreport_status,
                'roadreport_time': report.roadreport_time,
                'roadreport_region': report.roadreport_region
            }, status=status.HTTP_200_OK)

        except RoadReport.DoesNotExist:
            return Response({'error': '도로 보고 데이터가 존재하지 않습니다.'}, status=status.HTTP_404_NOT_FOUND)


# naver 지도 관련련
class NaverMapProxy(APIView):
    def get(self, request):
        start = request.query_params.get('start')  
        goal = request.query_params.get('goal')    

        if not start or not goal:
            return Response({'error': 'start와 goal 파라미터가 필요합니다.'}, status=status.HTTP_400_BAD_REQUEST)

        
        url = "https://maps.apigw.ntruss.com/map-direction/v1/driving"

        headers = {
            'X-NCP-APIGW-API-KEY-ID': os.environ.get('NAVER_API_KEY_ID'),
            'X-NCP-APIGW-API-KEY': os.environ.get('NAVER_API_KEY'),
        }

        params = {
            'start': start,
            'goal': goal,
            'option': 'trafast'  
        }

        try:
            naver_response = requests.get(url, headers=headers, params=params)
            return Response(naver_response.json(), status=naver_response.status_code)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class RoadReportCreate(APIView):
    def post(self, request):
        data = request.data
        report = RoadReport.objects.create(
            roadreport_time=data['roadreport_time'],
            roadreport_image=data['roadreport_image'],
            roadreport_latlng=data['roadreport_latlng'],
            roadreport_speed=data['roadreport_speed'],
            roadreport_direction=data['roadreport_direction'],
        )
        return Response({"message": "성공"}, status=201)


class NaverLocalSearch(APIView):
    def get(self, request):
        query = request.query_params.get('query')
        if not query:
            return Response({'error': '검색어(query)는 필수입니다.'}, status=400)

        url = "https://openapi.naver.com/v1/search/local.json"
        headers = {
            "X-Naver-Client-Id": os.environ.get("NAVER_CLIENT_ID"),
            "X-Naver-Client-Secret": os.environ.get("NAVER_CLIENT_SECRET"),
        }
        params = {
            "query": query,
            "display": 5,
            "start": 1,
            "sort": "random"
        }
        

        try:
            r = requests.get(url, headers=headers, params=params)
            return Response(r.json(), status=r.status_code)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


def gg_api_proxy(request):
    # 1) 서비스명 필수 파라미터
    service_name = request.GET.get("service")
    if not service_name:
        return JsonResponse({"error": "Service name required."}, status=400)

    # 2) 페이징 파라미터 (없으면 기본값)
    p_index = request.GET.get("pIndex", 1)
    p_size  = request.GET.get("pSize", 316)

    # 3) 외부 API URL 및 파라미터 구성
    url = f"https://openapi.gg.go.kr/{service_name}"
    params = {
        "KEY":    settings.GG_API_KEY,
        "Type":   "json",
        "pIndex": p_index,
        "pSize":  p_size,
    }

    # 4) OpenAPI 호출
    response = requests.get(url, params=params)
    if response.status_code != 200:
        return JsonResponse({
            "error":  "경기도 OpenAPI 호출 실패",
            "status": response.status_code
        }, status=502)

    data = response.json()
    # ---------------------------------------------------
    # 5) 추가 필터: 복구상태가 '복구중' 또는 '임시복구'인 것만 남기기
    try:
        # data[service_name] 은 [ {head}, {row: [...] } ]
        head, row_container = data.get(service_name, [None, {}])
        rows = row_container.get("row", [])

        # 실제 필터링
        filtered = [
            r for r in rows
            if r.get("RESTORE_STATE_NM") in ("복구중", "임시복구")
        ]

        # row 에 다시 할당
        row_container["row"] = filtered
        # 건수 정보 업데이트 (필요하다면)
        if head and "LIST_TOTAL_COUNT" in head:
            head["LIST_TOTAL_COUNT"] = len(filtered)

        # 덮어쓰기
        data[service_name] = [head, row_container]
    except Exception:
        # 필드 구조가 예상과 다를 경우 그냥 원본 반환
        pass
    # ---------------------------------------------------

    # 6) 결과를 그대로 반환
    return JsonResponse(data, safe=False)

class NaverGeocode(APIView):
    """
    지오코딩(주소 → 좌표) API
    GET 파라미터:
      - query: 변환할 주소 문자열 (예: "서울시 강남구 역삼로 123")
    """
    def get(self, request, *args, **kwargs):
        address = request.query_params.get("query")
        if not address:
            return Response({"error": "query 파라미터(required) 가 필요합니다."},
                            status=status.HTTP_400_BAD_REQUEST)

        url = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"
        headers = {
            "X-NCP-APIGW-API-KEY-ID": os.getenv("NAVER_API_KEY_ID"),
            "X-NCP-APIGW-API-KEY":    os.getenv("NAVER_API_KEY"),
        }
        params = {
            "query": address
        }

        try:
            r = requests.get(url, headers=headers, params=params, timeout=5)
            return Response(r.json(), status=r.status_code)
        except requests.RequestException as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)


class NaverReverseGeocode(APIView):
    """
    역지오코딩(좌표 → 주소) API
    GET 파라미터:
      - coords: "경도,위도" 포맷 문자열 (예: "127.02758,37.49794")
      - orders: (선택) 반환 우선순위, 기본 "addr,admcode"
      - output: (선택) 응답 형식, 기본 "json"
    """
    def get(self, request, *args, **kwargs):
        coords = request.query_params.get("coords")
        if not coords:
            return Response({"error": "coords 파라미터(required) 가 필요합니다."},
                            status=status.HTTP_400_BAD_REQUEST)

        orders = request.query_params.get("orders", "addr,admcode")
        output = request.query_params.get("output", "json")

        url = "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc"
        headers = {
            "X-NCP-APIGW-API-KEY-ID": os.getenv("NAVER_API_KEY_ID"),
            "X-NCP-APIGW-API-KEY":    os.getenv("NAVER_API_KEY"),
        }
        params = {
            "coords": coords,
            "orders": orders,
            "output": output
        }

        try:
            r = requests.get(url, headers=headers, params=params, timeout=5)
            return Response(r.json(), status=r.status_code)
        except requests.RequestException as e:
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)



def subsidence_info_proxy(request):
    sagoNo = request.GET.get("sagoNo")
    if not sagoNo:
        return JsonResponse({"results": []}, status=200)

    url     = "https://apis.data.go.kr/1611000/undergroundsafetyinfo/getSubsidenceInfo"
    api_key = os.getenv("UNDERSAFETY_API_KEY", "")
    params  = {
        "serviceKey": api_key,
        "sagoNo":     sagoNo,
        "numOfRows":  request.GET.get("numOfRows", 10),
        "pageNo":     request.GET.get("pageNo",    1),
        "type":       "json",
    }
    headers = {"User-Agent": "Mozilla/5.0"}

    # 1) 호출
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10, verify=False)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        # 실패해도 빈 리스트
        return JsonResponse({"results": []}, status=200)

    # 2) JSON / XML 둘 다 커버
    items = []
    # JSON 포맷일 때
    body = data.get("response", {}).get("body", {})
    raw = body.get("items", {}).get("item")
    if raw:
        if isinstance(raw, list):
            items = raw
        else:
            items = [raw]
    else:
        # XML 파싱 fallback
        root = ET.fromstring(resp.content)
        xml_items = root.findall(".//item")
        for el in xml_items:
            item = { 
                "sagoNo":     el.findtext("sagoNo"),
                "sido":       el.findtext("sido"),
                "siGunGu":    el.findtext("sgg"),     # xml 샘플은 <sgg>
                "dong":       el.findtext("dong"),
                "addr":       el.findtext("addr"),
                "sagoDate":   el.findtext("sagoDate"),
                "sagoLat":    el.findtext("sagoLat"),
                "sagoLon":    el.findtext("sagoLon"),
                "sinkWidth":  el.findtext("sinkWidth"),
                "sinkDepth":  el.findtext("sinkDepth"),
                "sinkExtend": el.findtext("sinkExtend"),
                "gridX":      el.findtext("gridX"),
                "gridY":      el.findtext("gridY"),
                "sagoDetail": el.findtext("sagoDetail"),
                "deathCnt":   el.findtext("deathCnt"),
                "injurCnt":   el.findtext("injuryCnt"),  # xml 샘플은 <injuryCnt>
                "vehicleCnt": el.findtext("vehicleCnt"),
                "trfStatus":  el.findtext("trfStatus"),
                "trMethod":   el.findtext("trMethod"),
                "trAmt":      el.findtext("trAmt"),
                "trFinDate":  el.findtext("trFinDate"),
                "dsdDate":    el.findtext("dsdDate"),
                "no":         el.findtext("no"),
            }
            items.append(item)

    # 3) 타입 정제 & 필터링
    results = []
    for i in items:
        # 필수: trfStatus, 좌표
        if i.get("trfStatus") == "복구완료":
            continue
        lat = i.get("sagoLat")
        lon = i.get("sagoLon")
        if not lat or not lon:
            continue

        # 숫자 변환 시도
        try:
            i["sagoLat"]   = float(lat)
            i["sagoLon"]   = float(lon)
            i["sinkWidth"] = float(i.get("sinkWidth") or 0)
            i["sinkDepth"] = float(i.get("sinkDepth") or 0)
            i["sinkExtend"]= float(i.get("sinkExtend") or 0)
            i["deathCnt"]  = int(i.get("deathCnt") or 0)
            i["injurCnt"]  = int(i.get("injurCnt") or 0)
            i["vehicleCnt"]= int(i.get("vehicleCnt") or 0)
        except ValueError:
            # 변환 실패해도 넘어감
            pass

        results.append(i)

    return JsonResponse({"results": results}, json_dumps_params={'ensure_ascii': False}, status=200)

"""
# 1. API 기본 설정
BASE = "http://apis.data.go.kr/1611000/undergroundsafetyinfo"
API_KEY = os.getenv("UNDERSAFETY_API_KEY", "")  # 디코딩 없이 그대로 사용

# 2. 페이지 단위 데이터 수집 함수
def fetch_one_page_xml(page: int, rows: int = 100):
    #2024년 지반침하 정보, 페이지 단위 XML 파싱
    base_url = f"{BASE}/getSubsidenceList?serviceKey={API_KEY}"
    query = urlencode({
        "sagoDateFrom": "20250101",
        "sagoDateTo":   "20251231",
        "numOfRows":    rows,
        "pageNo":       page,
    }, safe="%")

    url = f"{base_url}&{query}"
    print(f"[INFO] 요청 URL: {url}")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"  # User-Agent 없으면 오류날 수 있음
    }

    try:
        res = requests.get(url, headers=headers, timeout=10)
        print("[DEBUG] 응답 상태코드:", res.status_code)
        print("[DEBUG] 응답 본문 (앞부분):", res.text[:300])
        res.raise_for_status()
    except Exception as e:
        print(f"[ERROR] 요청 실패: {e}")
        return []

    try:
        data = xmltodict.parse(res.text)
    except Exception as e:
        print(f"[ERROR] XML 파싱 실패: {e}")
        return []

    # ✅ <resonse> 오타 대응
    response_data = data.get("response") or data.get("resonse") or {}
    header = response_data.get("header", {})
    print("[DEBUG] Header 내용:", header)

    result_code = header.get("resultCode", "")
    if result_code not in ("00", "0"):  # 공공데이터포털은 "0"도 성공 처리함
        print(f"[ERROR] API 호출 실패 - 코드: {result_code}")
        return []

    items_raw = response_data.get("body", {}).get("items", None)
    if not items_raw:
        print("[INFO] 데이터 없음")
        return []

    item_data = items_raw.get("item", [])
    if isinstance(item_data, dict):
        item_data = [item_data]

    return item_data

# 3. 전체 수집 API 뷰
def subsidence_list_proxy(request):
    #2024년 전체 지반침하 사고 리스트 반환
    all_items = []
    try:
        page = 1
        while True:
            items = fetch_one_page_xml(page)
            if not items:
                break
            all_items.extend(items)
            page += 1
    except Exception as e:
        print("[ERROR] getSubsidenceList XML 호출 실패:", repr(e))

    return JsonResponse(
        {"year": 2025, "count": len(all_items), "results": all_items},
        json_dumps_params={"ensure_ascii": False},
        status=200,
    )


def subsidence_detail_address(request):
    #지반침하 상세 주소 정보 조회 (sagoNo 기준)
    sagoNo = request.GET.get("sagoNo")
    if not sagoNo:
        return JsonResponse({"error": "sagoNo 파라미터가 필요합니다."}, status=400)

    url = f"{BASE}/getSubsidenceInfo"
    params = {
        "serviceKey": API_KEY,
        "sagoNo": sagoNo,
    }
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        res = requests.get(url, params=params, headers=headers, timeout=10)
        res.raise_for_status()
        data = xmltodict.parse(res.text)
    except Exception as e:
        return JsonResponse({"error": f"API 호출 실패: {e}"}, status=500)

    # resonse 오타 대응
    response_data = data.get("resonse") or data.get("response") or {}
    item = (
        response_data.get("body", {})
        .get("item", {})
    )

    if not item:
        return JsonResponse({"error": "해당 sagoNo에 대한 상세 정보 없음"}, status=404)

    # 주소 관련 필드만 추출해서 반환
    result = {
        "sagoNo": item.get("sagoNo"),
        "sido": item.get("sido"),
        "sigungu": item.get("sigungu") or item.get("siGunGu"),
        "dong": item.get("dong"),
        "addr": item.get("addr"),
    }

    return JsonResponse(result, json_dumps_params={"ensure_ascii": False}, status=200)
"""


# ── API 설정 ────────────────────────
API_KEY = os.getenv("UNDERSAFETY_API_KEY", "")  # 디코딩하지 않음
BASE = "http://apis.data.go.kr/1611000/undergroundsafetyinfo"
UA_HEADER = {"User-Agent": "Mozilla/5.0"}

# ── 상세조회 함수 ─────────────────────
def get_subsidence_detail_by_sago(sago_no: str) -> dict:
    url = (
        f"{BASE}/getSubsidenceInfo"
        f"?serviceKey={API_KEY}"
        f"&sagoNo={sago_no}"
    )
    try:
        res = requests.get(url, headers=UA_HEADER, timeout=5)
        res.raise_for_status()

        #print(f"[DETAIL-URL] {res.url}")
        #print(f"[DETAIL-XML] {res.text[:300]}")

        data = xmltodict.parse(res.text)
        resp = (
            data.get("response")
            or data.get("resonse")
            or data.get("OpenAPI_ServiceResponse", {})
        ).get("body", {})

        item = resp.get("items", {}).get("item", {}) or resp.get("item", {})
        if isinstance(item, dict):
            return {
                "dong": item.get("dong"),
                "addr": item.get("addr")
            }
        return {}
    except Exception as e:
        #print(f"[ERROR] 상세조회 실패 ({sago_no}): {e}")
        return {}

# ── 1페이지 조회 함수 ─────────────────────
def fetch_one_page_xml(page: int, rows: int = 100):
    query = urlencode({
        "sagoDateFrom": "20250101",
        "sagoDateTo":   "20251231",
        "numOfRows":    rows,
        "pageNo":       page,
    }, safe="%")
    url = f"{BASE}/getSubsidenceList?serviceKey={API_KEY}&{query}"

    try:
        res = requests.get(url, headers=UA_HEADER, timeout=10)
        res.raise_for_status()
        data = xmltodict.parse(res.text)
        #print(f"[LIST-URL] {url}")
        #print(f"[LIST-XML] {res.text[:300]}")
    except Exception as e:
        #print(f"[ERROR] 리스트 조회 실패: {e}")
        return []

    resp = data.get("response") or data.get("resonse") or {}
    if resp.get("header", {}).get("resultCode") not in ("0", "00"):
        return []

    items = resp.get("body", {}).get("items", {}).get("item", [])
    return [items] if isinstance(items, dict) else items

# ── 최종 통합 API 뷰 함수 ────────────────
def subsidence_list_proxy(request):
    all_items = []
    page = 1

    try:
        while True:
            items = fetch_one_page_xml(page)
            if not items:
                break

            for item in items:
                if item.get("trStatus") == "복구완료":
                    continue

                sago_no = item.get("sagoNo")
                if sago_no:
                    detail = get_subsidence_detail_by_sago(sago_no)
                    item["dong"] = detail.get("dong")
                    item["addr"] = detail.get("addr")
                all_items.append(item)

            page += 1
    except Exception as e:
        print(f"[ERROR] 전체 조회 실패: {e}")

    return JsonResponse(
        {"year": 2025, "count": len(all_items), "results": all_items},
        json_dumps_params={"ensure_ascii": False},
        status=200,
    )


class GeocacheStatsExport(APIView):
    """
    도로 파손 통계를 광역 및 기초자치단체 기준으로 정리한 엑셀 파일 생성 API
    """

    def get(self, request):
        try:
            # DB에서 geocache 테이블 데이터 가져오기
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT geocache_address, geocache_damagetype, geocache_count
                    FROM geocache
                """)
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]

            # Pandas DataFrame 변환
            df = pd.DataFrame(rows, columns=columns)
            df["광역"] = df["geocache_address"].str.extract(r'(.*?[도시])')
            df["기초"] = df["geocache_address"].str.extract(r'[도시]\s+(\S+?[구군시])')

            # 통계 계산
            wide = df.groupby(["광역", "geocache_damagetype"])["geocache_count"].sum().unstack(fill_value=0).reset_index()
            basic = df.groupby(["광역", "기초", "geocache_damagetype"])["geocache_count"].sum().unstack(fill_value=0).reset_index()

            # 저장 경로 설정
            save_dir = "media"
            os.makedirs(save_dir, exist_ok=True)
            save_path = os.path.join(save_dir, "도로파손통계.xlsx")

            # 엑셀 저장
            with pd.ExcelWriter(save_path) as writer:
                wide.to_excel(writer, index=False, sheet_name="광역 통계")
                basic.to_excel(writer, index=False, sheet_name="기초 통계")

            return Response(
                {"message": "통계 파일이 생성되었습니다.", "download_url": f"/media/도로파손통계.xlsx"},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
#이게 지오코드 실제 쓰는거
def VWorldGeocode(request, address):
    if not address:
        return JsonResponse({'error': '주소 파라미터가 필요합니다.'}, status=400)

    api_key = settings.VWORLD_API_KEY
    url = 'https://api.vworld.kr/req/address'

    params = {
        'service': 'address',
        'request': 'getCoord',
        'type': 'PARCEL',           # ← 지번주소 지정
        'crs': 'EPSG:4326',         # ← WGS84 기본좌표계
        'format': 'json',
        'key': api_key,
        'address': address,
    }

    try:
        res = requests.get(url, params=params, timeout=5)
        res.raise_for_status()
        data = res.json()
        point = data.get('response', {}).get('result', {}).get('point')
        if not point:
            return JsonResponse({'error': '좌표를 찾을 수 없습니다.'}, status=404)
        return JsonResponse({
            'address': address,
            'longitude': point['x'],
            'latitude': point['y']
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def geocode_address_backend(addr):
    url = 'https://api.vworld.kr/req/address'
    params = {
        'service': 'address',
        'request': 'getCoord',
        'format': 'json',
        'key': settings.VWORLD_API_KEY,
        'address': addr,
        'type': 'parcel',  # 'ANY'가 아닌 'parcel' (지번주소)로 수정
        'crs': 'EPSG:4326',
    }
    try:
        res = requests.get(url, params=params, timeout=3)
        res.raise_for_status()
        data = res.json()
        
        # VWorld API 응답에서 상태 확인
        if data.get('response', {}).get('status') != 'OK':
            error_msg = data.get('response', {}).get('error', {}).get('text', '알 수 없는 오류')
            print(f" [API 오류] {error_msg} (주소: {addr})")
            return None, None

        point = data.get("response", {}).get("result", {}).get("point")
        if point:
            return point.get("y"), point.get("x")  # 위도, 경도
    except requests.exceptions.RequestException as e:
        print(f" [요청 오류] {e}")
    except Exception as e:
        print(f" [기타 오류] {e}")
        
    return None, None

def gg_api_geocoded_proxy(request):
    # 1) 필수 파라미터
    service_name = request.GET.get("service")
    if not service_name:
        return JsonResponse({"error": "Service name required."}, status=400)

    # 2) 페이징 파라미터
    p_index = request.GET.get("pIndex", 1)
    p_size = request.GET.get("pSize", 316)

    # 3) API 호출
    url = f"https://openapi.gg.go.kr/{service_name}"
    params = {
        "KEY": settings.GG_API_KEY,
        "Type": "json",
        "pIndex": p_index,
        "pSize": p_size,
    }

    response = requests.get(url, params=params)
    if response.status_code != 200:
        return JsonResponse({
            "error": "경기도 OpenAPI 호출 실패",
            "status": response.status_code
        }, status=502)

    data = response.json()

    try:
        head, row_container = data.get(service_name, [None, {}])
        rows = row_container.get("row", [])

        filtered = [
            r for r in rows
            if r.get("RESTORE_STATE_NM") in ("복구중", "임시복구")
        ]

        # ⛳ 주소 기반 좌표 추가
        for r in filtered:
            addr = r.get("ADDR") or r.get("REFINE_LOTNO_ADDR") or ""
            if addr:
                lat, lon = geocode_address_backend(addr)
                r["latitude"] = lat
                r["longitude"] = lon
                time.sleep(0.1)  # VWorld 제한 회피용 (초당 3건 제한)

        # row 재할당 및 건수 수정
        row_container["row"] = filtered
        if head and "LIST_TOTAL_COUNT" in head:
            head["LIST_TOTAL_COUNT"] = len(filtered)
        data[service_name] = [head, row_container]
    except Exception:
        pass  # 구조 다르면 그냥 원본

    return JsonResponse(data, safe=False)

"""
# SubsidenceReport (지반침하) 전체 조회 API
class SubsidenceReportListView(APIView):
    def get(self, request):
        # 위도(latitude)와 경도(longitude)가 null이 아닌 데이터만 필터링
        reports = SubsidenceReport.objects.filter(
            latitude__isnull=False,
            longitude__isnull=False
        )
        serializer = SubsidenceReportSerializer(reports, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
"""
class SubsidenceCoordListView(APIView):
    def get(self, request):
        # 위도/경도 NULL 제외 + 0값 제외
        qs = (
            SubsidenceReport.objects
            .filter(latitude__isnull=False, longitude__isnull=False)
            .exclude(latitude=0).exclude(longitude=0)
            .values(
                "sido",       # 시도
                "sigungu",    # 시군구
                "sagoDetail", # 사고 상세
                "sagoDate",   # 사고 날짜
                "dong",       # 동
                "addr",       # 주소
                "latitude",   # 위도
                "longitude"   # 경도
            )
            .distinct()
        )

        data = list(qs)
        return Response(data, status=status.HTTP_200_OK)

class GGSubsidenceListView(APIView):
    """
    경기도 지반침하 리스트 (필드 최소화)
    반환: sido, sigungu, sagoDetail, addr, sagoDate, latitude, longitude (+ lat/lng 별칭)
    """
    DEFAULT_LIMIT = 500

    def get(self, request):
        qs = GGSubsidenceReport.objects.all()

        # --- 필터 ---
        sido = request.GET.get("sido")
        sigungu = request.GET.get("sigungu")
        has_coords = (request.GET.get("has_coords") or "").lower() in ("1", "true", "yes")

        if sido:
            qs = qs.filter(sido=sido)
        if sigungu:
            qs = qs.filter(sigungu=sigungu)

        if has_coords:
            qs = qs.filter(
                latitude__isnull=False,
                longitude__isnull=False,
            ).exclude(
                latitude__in=["", "0", 0, 0.0]
            ).exclude(
                longitude__in=["", "0", 0, 0.0]
            )

        # --- 페이지네이션 ---
        try:
            limit = int(request.GET.get("limit", self.DEFAULT_LIMIT))
            offset = int(request.GET.get("offset", 0))
        except ValueError:
            return JsonResponse({"error": "limit/offset must be integers"}, status=400)

        if limit <= 0 or limit > 2000:
            limit = self.DEFAULT_LIMIT
        if offset < 0:
            offset = 0

        total = qs.count()

        # 필요한 필드만 select
        rows = (
            qs.order_by("-sagoDate")
              .values("sido", "sigungu", "sagoDetail", "addr", "sagoDate", "latitude", "longitude")[offset:offset + limit]
        )

        results = []
        for r in rows:
            lat_raw = r.get("latitude")
            lng_raw = r.get("longitude")
            lat = float(lat_raw) if lat_raw not in (None, "", "0") else None
            lng = float(lng_raw) if lng_raw not in (None, "", "0") else None

            results.append({
                "sido": r.get("sido"),
                "sigungu": r.get("sigungu"),
                "sagoDetail": r.get("sagoDetail"),
                "addr": r.get("addr"),
                "sagoDate": r.get("sagoDate"),
                "latitude": lat,
                "longitude": lng,
                "lat": lat,   # 별칭
                "lng": lng,   # 별칭
            })

        return JsonResponse({
            "count": total,
            "limit": limit,
            "offset": offset,
            "results": results,
        }, status=200)
    


class GGSubsidenceView(APIView):
    def get(self, request):
        qs = GGSubsidenceReport.objects.all()

        rows = qs.order_by("-sagoDate").values(
            "sido", "sigungu", "sagoDetail", "addr", "sagoDate", "latitude", "longitude"
        )[:500]

        data = []
        for r in rows:
            lat = float(r["latitude"]) if r["latitude"] else None
            lng = float(r["longitude"]) if r["longitude"] else None
            data.append({
                "sido": r["sido"],
                "sigungu": r["sigungu"],
                "sagoDetail": r["sagoDetail"],
                "addr": r["addr"],
                "sagoDate": r["sagoDate"],
                "lat": lat,
                "lng": lng,
            })

        return JsonResponse(data, safe=False)