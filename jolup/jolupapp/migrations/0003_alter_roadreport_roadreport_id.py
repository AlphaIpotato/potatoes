# Generated by Django 5.1.6 on 2025-03-18 15:53

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('jolupapp', '0002_alter_userhistory_userhistory_end_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='roadreport',
            name='roadreport_id',
            field=models.CharField(max_length=100),
        ),
    ]
