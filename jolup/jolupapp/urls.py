from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MasterSignUp, MasterLogin, UserSignUp, UserLogin, UserSignOut, UserInfo,RoadReportSelectWithCoords,
    RoadReportAll, RoadReportSelect, HardwarePull, AiPull, RoadReportDelete, RoadReportEdit, UsersViewSet, MasterViewSet, UserHistoryViewSet, RoadReportViewSet,
    NaverMapProxy,RoadReportCreate,NaverLocalSearch,UserUpdate,UserPasswordChange,gg_api_proxy,NaverGeocode, NaverReverseGeocode,subsidence_info_proxy,
    subsidence_list_proxy,GeocacheStatsExport,VWorldGeocode,gg_api_geocoded_proxy, GGSubsidenceListView, SubsidenceCoordListView ,SubsidenceCoordListView,GGSubsidenceView
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
    path('vworld/geocode/<str:address>/', VWorldGeocode, name='vworld-geocode'),
    #path('driving/', NaverMapProxy.as_view(),name='naver_map_proxy')
    # 도로 보고 이미지 업로드 API
    path("roadreport/create", RoadReportCreate.as_view()),
    path("ggdata", gg_api_proxy),
    #naver geo ,역geo
    path('naver/geocode/',       NaverGeocode.as_view(),         name='naver-geocode'),
    path('naver/reverse-geocode/', NaverReverseGeocode.as_view(),  name='naver-reverse-geocode'),
    #공공데이터(국토부)
    path("api/subsidence/", subsidence_info_proxy),
    path("api/subsidence_list/", subsidence_list_proxy), #단일로 가능
    #path("api/subsidence_detail/", subsidence_detail_address),
    path("ggdata", gg_api_proxy),
    #통계 데이터
    path("api/export_stats/", GeocacheStatsExport.as_view(), name="export_stats"),
    #경기도 데이터+ 지오코드
    path("api/subsidence_with_coords/", gg_api_geocoded_proxy, name="subsidence-with-coords"),
    # 지반침하 데이터 전체 조회 API
    #path("api/subsidence-reports/", SubsidenceReportListView.as_view(), name="subsidence-report-list"),
    path('api/subsidence/coords/',SubsidenceCoordListView.as_view(),name='subsidence-coords'),  # 지도 마커용 좌표만 제공하는 엔드포인트
    # 경기도 지반침하 좌표 리스트 API (필터/페이지네이션 지원)

    path("gg/subsidence/", GGSubsidenceView.as_view(), name="gg_subsidence_list"),

    
]
