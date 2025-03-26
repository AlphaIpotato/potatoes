from rest_framework import serializers
from .models import Users, Master, UserHistory, RoadReport
from django.contrib.auth.hashers import make_password#+

class UsersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = "__all__"  # 모든 필드를 포함

    def create(self, validated_data):
        validated_data['user_pw'] = make_password(validated_data['user_pw'])
        return super().create(validated_data)

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
        fields = "__all__"

        
