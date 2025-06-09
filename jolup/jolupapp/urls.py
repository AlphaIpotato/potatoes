from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MasterSignUp, MasterLogin, UserSignUp, UserLogin, UserSignOut, UserInfo,RoadReportSelectWithCoords,
    RoadReportAll, RoadReportSelect, HardwarePull, AiPull, RoadReportDelete, RoadReportEdit, UsersViewSet, MasterViewSet, UserHistoryViewSet, RoadReportViewSet,
    NaverMapProxy,RoadReportCreate,NaverLocalSearch,UserUpdate,UserPasswordChange,gg_api_proxy
)
from . import views
# Router 설정
router = DefaultRouter()
router.register(r'users', UsersViewSet)
router.register(r'masters', MasterViewSet)
router.register(r'userhistory', UserHistoryViewSet)
router.register(r'roadreports', RoadReportViewSet)

# URL 패턴 등록
urlpatterns = [
    path('api/', include(router.urls)),  # API 엔드포인트 자동 생성
    path('', views.index, name='index'), # 메인 페이지
    path('object_detection_stream/', views.object_detection_stream, name='object_detection_stream'), # 객체 인식 스트림 URL
    # 관리자 API
    path('master/signup', MasterSignUp.as_view(), name='master-signup'),
    path('master/login', MasterLogin.as_view(), name='master-login'),

    # 사용자 API
    path('users/signup', UserSignUp.as_view(), name='user-signup'),
    path('users/login', UserLogin.as_view(), name='user-login'),
    path('users/signout', UserSignOut.as_view(), name='user-signout'),
    path('users/info/<str:user_id>/', UserInfo.as_view(), name='user-info'),
    path('users/update/<str:user_id>/', UserUpdate.as_view(), name='user-update'),
    path('users/update/password/<str:user_id>/', UserPasswordChange.as_view(), name='user-password-change'),

    # 도로 보고 API
    path('roadreport/all', RoadReportAll.as_view(), name='roadreport-all'),
    path('roadreport/select/<str:roadreport_num>/', RoadReportSelect.as_view(), name='roadreport-select'),
    #path('roadreport/select', RoadReportSelect.as_view(), name='roadreport-select'),
    path('roadreport/delete/<int:roadreport_num>/', RoadReportDelete.as_view(), name='roadreport-delete'),
    #path('roadreport/edit', RoadReportEdit.as_view(), name='roadreport-edit'),
    path('roadreport/edit/<int:roadreport_num>/', RoadReportEdit.as_view(), name='roadreport_edit'),

    # 하드웨어 정보 및 AI 관련 API
    path('hardware/pull/', HardwarePull.as_view(), name='hardware-pull'),
    path('ai/pull', AiPull.as_view(), name='ai-pull'),
    #위도와 경도 분리 api
    path('api/roadreport/select_with_coords/<str:report_id>/', RoadReportSelectWithCoords.as_view(), name='roadreport-select-with-coords'),
    #naver 지도 api
    path('naver/proxy/', NaverMapProxy.as_view(), name='naver_map_proxy'),
    path('naver/search/', NaverLocalSearch.as_view(), name='naver-local-search'),
    #path('driving/', NaverMapProxy.as_view(),name='naver_map_proxy')
    # 도로 보고 이미지 업로드 API
    path("roadreport/create", RoadReportCreate.as_view()),
    path("ggdata", gg_api_proxy),

]
