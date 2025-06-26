import cv2
from django.shortcuts import render
from django.http import StreamingHttpResponse
import time
import os
# Create your views here.
from .serializers import UsersSerializer, MasterSerializer, UserHistorySerializer, RoadReportSerializer
from django.contrib.auth.hashers import make_password, check_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from .models import Users, Master, UserHistory, RoadReport
from django.http import JsonResponse
import pytz
from datetime import datetime
import requests
from django.conf import settings
import torch
import numpy as np
from pathlib import Path
from ultralytics import YOLO
from functools import lru_cache
from math import radians, cos, sin, asin, sqrt
import pathlib #이 세줄이 욜로 리눅스 문제일때때
temp = pathlib.PosixPath 
pathlib.PosixPath = pathlib.WindowsPath


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
    def post(self, request):
        master_id = request.data.get('master_id')
        master_pw = request.data.get('master_pw')

        try:
            master = Master.objects.get(master_id=master_id)
            if check_password(master_pw, master.master_pw):
                return Response({'message': '관리자 로그인 성공'}, status=status.HTTP_200_OK)
            else:
                return Response({'error': '비밀번호가 틀렸습니다.'}, status=status.HTTP_401_UNAUTHORIZED)
        except Master.DoesNotExist:
            return Response({'error': '관리자 계정이 존재하지 않습니다.'}, status=status.HTTP_404_NOT_FOUND)


# 사용자 회원가입 API
class UserSignUp(APIView):
    def post(self, request):
        serializer = UsersSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user_pw=make_password(serializer.validated_data['user_pw']))
            return Response({'message': '회원가입 성공'}, status=status.HTTP_201_CREATED)
        return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


# 사용자 로그인 API
class UserLogin(APIView):
    def get(self, request):
        user_id = request.data.get('user_id')
        user_pw = request.data.get('user_pw')

        try:
            user = Users.objects.get(user_id=user_id)
            if check_password(user_pw, user.user_pw):
                return Response({'message': '사용자 로그인 성공'}, status=status.HTTP_200_OK)
            else:
                return Response({'error': '비밀번호가 틀렸습니다.'}, status=status.HTTP_401_UNAUTHORIZED)
        except Users.DoesNotExist:
            return Response({'error': '사용자 계정이 존재하지 않습니다.'}, status=status.HTTP_404_NOT_FOUND)


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
            model = YOLO("C:/Users/ysyhs/Desktop/jolup/models/yoloV8v4.pt")
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