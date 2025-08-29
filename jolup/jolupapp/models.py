# Create your models here.
from django.db import models
from django.contrib.auth.hashers import make_password

class Users(models.Model):
    user_id = models.CharField(max_length=20, primary_key=True)
    user_pw = models.CharField(max_length=128)  # 암호화 저장을 고려하여 길이 증가
    user_name = models.CharField(max_length=10)
    user_age = models.PositiveIntegerField()
    user_phonenumber = models.CharField(max_length=15, null=True, blank=True)

    def save(self, *args, **kwargs):
        # 비밀번호가 해시되지 않은 경우에만 해싱 처리 (이중 암호화 방지)
        if not self.user_pw.startswith('pbkdf2_'):
            self.user_pw = make_password(self.user_pw)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.user_name  

    class Meta:
        db_table = 'Users'

class Master(models.Model):
    master_id = models.CharField(max_length=20, primary_key=True)
    master_pw = models.CharField(max_length=128)
    master_name = models.CharField(max_length=10)
    master_phonenumber = models.CharField(max_length=15)
    master_grade = models.CharField(max_length=10)

    def save(self, *args, **kwargs):
        # 비밀번호가 해시되지 않은 경우에만 해싱 처리 (이중 암호화 방지)
        if not self.master_pw.startswith('pbkdf2_'):
            self.master_pw = make_password(self.master_pw)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.master_name  

    class Meta:
        db_table = 'Master'

class UserHistory(models.Model):  
    user = models.ForeignKey(Users, on_delete=models.CASCADE, related_name='road_records') 
    userhistory_start = models.CharField(max_length=255,null=True)
    userhistory_end = models.CharField(max_length=255,null=True)
    userhistory_via = models.CharField(max_length=255,null=True)
    userhistory_searchtime = models.DateTimeField(auto_now_add=True)  

    class Meta:
        db_table = 'userhistory'

class RoadReport(models.Model):  
    roadreport_num = models.AutoField(primary_key=True)  
    roadreport_latlng = models.CharField(max_length=100)
    roadreport_image = models.ImageField(upload_to='images/',null=True,blank=True)
    roadreport_damagetype = models.CharField(max_length=50,null=True)
    roadreport_status = models.CharField(max_length=20, null=True, blank=True, default="접수됨")
    roadreport_time = models.DateTimeField(auto_now_add=True,null=True)
    roadreport_direction = models.FloatField(null=True, blank=True)  
    roadreport_speed = models.FloatField(null=True, blank=True)  
    #roadreport_count = models.Int(null=True,blank=True)
    roadreport_count = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'roadreport'

class GeoCache(models.Model):
    geocache_latlng = models.CharField(max_length=100, unique=True)
    geocache_address = models.CharField(max_length=255)
    geocache_damagetype = models.CharField(max_length=50, null=True, blank=True)  # 🆕 추가
    geocache_count = models.PositiveIntegerField(null=True, blank=True)           # 🆕 추가
    geocache_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'geocache'


class SubsidenceReport(models.Model):
    sagoNo = models.CharField(max_length=50, primary_key=True) # 사고번호
    sido = models.CharField(max_length=50, blank=True, null=True) # 시도
    sigungu = models.CharField(max_length=50, blank=True, null=True) # 시군구
    sagoDetail = models.CharField(max_length=255, blank=True, null=True) # 사고 상세
    sagoDate = models.CharField(max_length=20, blank=True, null=True) # 사고일시
    no = models.IntegerField(blank=True, null=True) # 번호
    dong = models.CharField(max_length=50, blank=True, null=True) # 동
    addr = models.CharField(max_length=255, blank=True, null=True) # 주소
    latitude = models.FloatField(blank=True, null=True)  # 위도
    longitude = models.FloatField(blank=True, null=True)  # 경도

    def __str__(self):
        return self.sagoNo

    class Meta:
        db_table = 'subsidence_report'

from django.db import models

class GGSubsidenceReport(models.Model):
    sagoNo = models.CharField(max_length=50, primary_key=True)  # 사고번호
    sido = models.CharField(max_length=50, blank=True, null=True)       # 시도
    sigungu = models.CharField(max_length=50, blank=True, null=True)    # 시군구
    dong = models.CharField(max_length=50, blank=True, null=True)       # 동
    addr = models.CharField(max_length=255, blank=True, null=True)      # 상세주소
    sagoDate = models.CharField(max_length=20, blank=True, null=True)   # 사고일시
    restoreState = models.CharField(max_length=50, blank=True, null=True)  # 복구상태명
    sagoDetail = models.CharField(max_length=255, blank=True, null=True)   # 사고상세
    no = models.IntegerField(blank=True, null=True)                      # 번호
    latitude = models.FloatField(blank=True, null=True)                  # 위도
    longitude = models.FloatField(blank=True, null=True)                 # 경도

    def __str__(self):
        return self.sagoNo

    class Meta:
        db_table = "gg_subsidence_report"   # 실제 DB 테이블명 고정


""" 참고사항
비밀번호 암호화를 고려하여 user_pw와 master_pw 길이를 128로 늘림.
전화번호 필드는 IntegerField 대신 CharField(max_length=15)로 변경.
클래스명은 CamelCase를 따름 (userhistory → UserHistory, roadreport → RoadReport).
ForeignKey 설정은 적절하지만, 필요하면 ManyToManyField 고려 가능.
make_password()를 이용한 비밀번호 암호화 유지"""



