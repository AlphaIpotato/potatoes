from rest_framework import serializers
from .models import Users, Master, UserHistory, RoadReport, GeoCache, SubsidenceReport
from django.contrib.auth.hashers import make_password#+

class UsersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = "__all__"  # 모든 필드를 포함

class MasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Master
        fields = "__all__"

class UserHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserHistory
        fields = "__all__"

class RoadReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoadReport
        fields = '__all__'

class GeoCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeoCache
        fields = '__all__'

class SubsidenceReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubsidenceReport
        fields = '__all__'

        
