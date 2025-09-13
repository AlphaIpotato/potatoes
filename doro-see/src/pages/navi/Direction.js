import React, {useEffect, useRef, useState} from "react";
import {useLocation} from "react-router-dom";
import {MapContext} from '../MapContext';
import SearchPlaceBar from "../../components/SearchPlaceBar";

function getDistance(lat1, lon1, lat2, lon2) {
    if ((lat1 === lat2) && (lon1 === lon2)) {
        return 0;
    }
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

function speak(text, enabled) {
    if (!enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.2;
    window.speechSynthesis.speak(utterance);
}

function Direction() {
    const location = useLocation();
    const routeData = location.state?.fetchedData?.route?.trafast?.[0] || null;

    const naver = window.naver;
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const locationMarker = useRef(null);
    const currentLocationMarker = useRef(null); // 현재위치 버튼으로 생성되는 마커
    const isDrag = useRef(false);
    const watchId = useRef(null);
    const announcedGuides = useRef(new Set());
    const announcedDamages = useRef(new Set());

    const [map, setMap] = useState(null);
    const [nextGuideIndex, setNextGuideIndex] = useState(0);
    const [currentInstruction, setCurrentInstruction] = useState("경로 안내를 시작합니다.");
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(true);
    const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
    const [damageData, setDamageData] = useState([]);
    const [subsidenceData, setSubsidenceData] = useState([]);
    const [ggSubsidenceData, setGgSubsidenceData] = useState([]);
    const [currentPosition, setCurrentPosition] = useState(null);
    const [testPosition, setTestPosition] = useState(null);
    const [isTestLocationOpen, setIsTestLocationOpen] = useState(false);

    const path = routeData?.path || [];
    const guide = routeData?.guide || [];
    const summary = routeData?.summary || {};
    const distance = summary?.distance ?? routeData?.distance ?? null;
    const duration = summary?.duration ?? routeData?.duration ?? null;
    const fetchedCurrentDateTime = location.state?.fetchedData?.currentDateTime || null;
    const departureTime = fetchedCurrentDateTime ? new Date(fetchedCurrentDateTime) : new Date();
    const start = path.length > 0 ? path[0] : [];
    const goal = path.length > 0 ? path[path.length - 1] : [];

    const polylineInstance = useRef(null);
    const startMarkerInstance = useRef(null);
    const goalMarkerInstance = useRef(null);
    const guideMarkerInstance = useRef([]);
    const damageMarkersRef = useRef([]);
    const subsidenceMarkersRef = useRef([]);
    const ggSubsidenceMarkersRef = useRef([]);

    // 파손 데이터 및 지반침하 데이터 가져오기
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const [damageResponse, subsidenceResponse, ggSubsidenceResponse] = await Promise.all([
                    fetch('http://localhost:8000/roadreport/all', {
                        headers: {'Content-Type': 'application/json'}
                    }),
                    fetch('http://localhost:8000/api/subsidence/coords/', {
                        headers: {'Content-Type': 'application/json'}
                    }),
                    fetch('http://localhost:8000/gg/subsidence/', {
                    headers: {'Content-Type': 'application/json'}
                    })
                ]);

                if (damageResponse.ok) {
                    const damageData = await damageResponse.json();
                    setDamageData(damageData);
                    console.log('도로 파손 데이터 로드됨:', damageData.length, '건');
                    console.log('도로 파손 데이터 구조 확인:', damageData.slice(0, 2)); // 처음 2개 데이터 구조 확인
                } else {
                    console.error('도로 파손 데이터 로드 실패:', damageResponse.status, damageResponse.statusText);
                }

                if (subsidenceResponse.ok) {
                    const subsidenceData = await subsidenceResponse.json();
                    setSubsidenceData(subsidenceData);
                    console.log('지반침하 데이터 로드됨:', subsidenceData.length, '건');
                }

                if (ggSubsidenceResponse.ok) {
                    const ggSubsidenceData = await ggSubsidenceResponse.json();
                    setGgSubsidenceData(ggSubsidenceData);
                    console.log('경기도 지반침하 데이터 로드됨:', ggSubsidenceData.length, '건');
                }
            } catch (error) {
                console.error('데이터 로드 실패:', error);
            }
        };
        fetchAllData();
    }, []);

    useEffect(() => {
        if (!window.naver || map) return;
        const {naver} = window;

        const mapInstanceRef = new naver.maps.Map(mapRef.current, {
            center: new naver.maps.LatLng(37.713848, 126.889435),
            zoom: 13,
            minZoom: 7,
            zoomControl: true,
            zoomControlOptions: {position: naver.maps.Position.TOP_RIGHT},
            mapTypeControl: true,
        });

        mapInstance.current = mapInstanceRef;
        setMap(mapInstanceRef);

        // init 이벤트 이후 Control과 Event Listener 생성
        naver.maps.Event.once(mapInstanceRef, 'init', () => {
            console.log('NAVER Maps JavaScript API v3 초기화 완료');
            
            // Drag 이벤트 리스너 추가
            naver.maps.Event.addListener(mapInstanceRef, 'dragstart', () => {
                isDrag.current = true;
            });
            naver.maps.Event.addListener(mapInstanceRef, 'dragend', () => {
                isDrag.current = false;
            });

            // GPS 위치 버튼 Control 생성 - 오른쪽 위 지도 타입 컨트롤 아래에 배치
            const locationBtnHtml = `<img src="/media/icon_gps.png" style="background-color: #FFFFFF; padding: 0.5vh; cursor: pointer; border: 1px solid #E81E24; border-radius: 0.5vh; margin-top: 10px;">`;
            const locationBtn = new naver.maps.CustomControl(locationBtnHtml, {position: naver.maps.Position.TOP_RIGHT});
            locationBtn.setMap(mapInstanceRef);

            // GPS 버튼 클릭 이벤트
            naver.maps.Event.addDOMListener(locationBtn.getElement(), 'click', () => {
                isDrag.current = false;
                console.log('GPS 버튼 클릭됨');
                
                navigator.geolocation.getCurrentPosition((pos) => {
                    const {latitude, longitude, accuracy} = pos.coords;
                    const newLocation = new naver.maps.LatLng(latitude, longitude);
                    
                    console.log('GPS 버튼으로 현재 위치 받음:', { 
                        latitude, 
                        longitude, 
                        accuracy: `${accuracy}m`
                    });
                    
                    mapInstanceRef.setCenter(newLocation);
                    mapInstanceRef.setZoom(16);
                    
                    // 기존 현재위치 마커가 있으면 제거
                    if (currentLocationMarker.current) {
                        currentLocationMarker.current.setMap(null);
                    }
                    
                    // 새로운 현재위치 마커 생성
                    currentLocationMarker.current = new naver.maps.Marker({
                        map: mapInstanceRef,
                        position: newLocation,
                        icon: {
                            url: "/media/icon_navigation.png",
                            size: new naver.maps.Size(32, 32),
                            anchor: new naver.maps.Point(16, 16)
                        },
                        title: `현재 위치 (정확도: ${Math.round(accuracy)}m)`
                    });
                    
                    // 현재 위치 상태 업데이트
                    setCurrentPosition({latitude, longitude});
                    console.log('GPS 버튼으로 현재 위치 마커 생성됨');
                }, (error) => {
                    console.error("GPS 버튼 위치 정보 오류:", error);
                    let errorMessage = "위치 정보를 가져올 수 없습니다.";
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = "위치 접근 권한이 거부되었습니다.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = "위치 정보를 사용할 수 없습니다.";
                            break;
                        case error.TIMEOUT:
                            errorMessage = "위치 요청 시간이 초과되었습니다.";
                            break;
                    }
                    alert(errorMessage);
                }, {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                });
            });
        });

    }, [map]);

    // Collapse search bar automatically once a route is available
    useEffect(() => {
        if (guide && guide.length > 0) {
            setIsSearchCollapsed(true);
        }
    }, [guide]);

    useEffect(() => {
        if (!map || path.length === 0) return;

        const pathData = path.map(coord => new naver.maps.LatLng(coord[1], coord[0]));

        if (polylineInstance.current) polylineInstance.current.setMap(null);
        polylineInstance.current = new naver.maps.Polyline({
            map,
            path: pathData,
            strokeColor: "#E81E24",
            strokeWeight: 4
        });

        if (startMarkerInstance.current) startMarkerInstance.current.setMap(null);
        startMarkerInstance.current = new naver.maps.Marker({
            map,
            position: new naver.maps.LatLng(start[1], start[0]),
            icon: {url: "/media/icon_location.png"}
        });

        if (goalMarkerInstance.current) goalMarkerInstance.current.setMap(null);
        goalMarkerInstance.current = new naver.maps.Marker({
            map,
            position: new naver.maps.LatLng(goal[1], goal[0]),
            icon: {url: "/media/icon_location_goal.png"}
        });

        guideMarkerInstance.current.forEach(marker => marker.setMap(null));
        guideMarkerInstance.current = guide.map(guideItem => {
            const point = path[guideItem.pointIndex];
            return new naver.maps.Marker({
                map,
                position: new naver.maps.LatLng(point[1], point[0]),
                icon: {
                    url: "/media/free-icon-rec-190256.png",
                    size: new naver.maps.Size(16, 16),
                    anchor: new naver.maps.Point(8, 8)
                },
                title: guideItem.instructions
            });
        });

        map.setCenter(new naver.maps.LatLng(start[1], start[0]));
        map.setZoom(16);
        setCurrentInstruction("경로 안내를 시작합니다.");

    }, [map, path, guide]);

    useEffect(() => {
        if (!map || !routeData || !navigator.geolocation) return;

        speak("경로 안내를 시작합니다.", isVoiceEnabled);

        watchId.current = navigator.geolocation.watchPosition(
            (position) => {
                const {latitude, longitude, accuracy} = position.coords;
                const currentLocation = new naver.maps.LatLng(latitude, longitude);
                
                console.log('현재 위치 받음:', { 
                    latitude, 
                    longitude, 
                    accuracy: `${accuracy}m`,
                    timestamp: new Date().toLocaleTimeString()
                });
                
                // 현재 위치 상태 업데이트
                setCurrentPosition({latitude, longitude});

                if (!locationMarker.current) {
                    locationMarker.current = new naver.maps.Marker({
                        map,
                        position: currentLocation,
                        icon: {
                            url: "/media/icon_navigation.png",
                            size: new naver.maps.Size(32, 32),
                            anchor: new naver.maps.Point(16, 16)
                        },
                        title: `현재 위치 (정확도: ${Math.round(accuracy)}m)`
                    });
                    console.log('현재 위치 마커 생성됨');
                } else {
                    locationMarker.current.setPosition(currentLocation);
                    locationMarker.current.setTitle(`현재 위치 (정확도: ${Math.round(accuracy)}m)`);
                }

                if (!isDrag.current) {
                    map.setCenter(currentLocation);
                    console.log('지도 중심을 현재 위치로 이동');
                }

                if (nextGuideIndex >= guide.length) {
                    if (!announcedGuides.current.has("finished")) {
                        setCurrentInstruction("목적지에 도착했습니다. 경로 안내를 종료합니다.");
                        speak("목적지에 도착했습니다. 경로 안내를 종료합니다.", isVoiceEnabled);
                        announcedGuides.current.add("finished");
                        if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
                    }
                    return;
                }

                const nextGuide = guide[nextGuideIndex];
                const nextPointCoords = path[nextGuide.pointIndex];
                const dist = getDistance(latitude, longitude, nextPointCoords[1], nextPointCoords[0]);

                if (dist < 50 && !announcedGuides.current.has(nextGuideIndex)) {
                    const instructionText = nextGuide.instructions;
                    setCurrentInstruction(instructionText);
                    speak(`잠시 후 ${instructionText}`, isVoiceEnabled);
                    announcedGuides.current.add(nextGuideIndex);
                }

                if (dist < 15) setNextGuideIndex(prevIndex => prevIndex + 1);

                // 파손 마커 감지 및 경고
                checkNearbyDamages(latitude, longitude);
            },
            (error) => {
                console.error("Geolocation error:", error);
                let errorMessage = "위치 정보를 가져올 수 없습니다.";
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "위치 접근 권한이 거부되었습니다.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "위치 정보를 사용할 수 없습니다.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "위치 요청 시간이 초과되었습니다.";
                        break;
                }
                setCurrentInstruction(errorMessage);
            },
            {
                enableHighAccuracy: true, 
                timeout: 20000, 
                maximumAge: 0
            }
        );

        return () => {
            if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
            if (currentLocationMarker.current) currentLocationMarker.current.setMap(null);
            if (locationMarker.current) locationMarker.current.setMap(null);
            damageMarkersRef.current.forEach(marker => marker.setMap(null));
            subsidenceMarkersRef.current.forEach(marker => marker.setMap(null));
            ggSubsidenceMarkersRef.current.forEach(marker => marker.setMap(null));
            window.speechSynthesis.cancel();
        };
    }, [map, routeData, nextGuideIndex, isVoiceEnabled, damageData, subsidenceData, ggSubsidenceData]);

    // 도로 파손 마커 표시
    useEffect(() => {
        if (!map || !damageData || damageData.length === 0) {
            console.log('도로 파손 마커 표시 건너뜀:', { map: !!map, damageData: damageData?.length || 0 });
            return;
        }

        console.log('도로 파손 마커 표시 시작:', damageData.length, '건');

        // 기존 도로 파손 마커들 제거
        damageMarkersRef.current.forEach(marker => marker.setMap(null));
        damageMarkersRef.current = [];

        damageData.forEach((road, index) => {
            if (!road.roadreport_latlng) return;
            
            try {
                const [lat, lng] = road.roadreport_latlng.split(',').map(coord => parseFloat(coord.trim()));
                
                if (isNaN(lat) || isNaN(lng)) return;

                const iconType = road.roadreport_damagetype && road.roadreport_damagetype.includes("pothole")
                    ? "/media/icon_pothole.png"
                    : "/media/icon_crack.png";

                const marker = new naver.maps.Marker({
                    position: new naver.maps.LatLng(lat, lng),
                    map,
                    icon: {
                        url: iconType,
                        size: new naver.maps.Size(32, 32),
                        origin: new naver.maps.Point(0, 0),
                        anchor: new naver.maps.Point(16, 16)
                    },
                    title: `${road.roadreport_damagetype || '도로 파손'} - ${road.roadreport_status || '상태 정보 없음'}`
                });

                damageMarkersRef.current.push(marker);
            } catch (error) {
                console.error('도로 파손 데이터 파싱 오류:', error);
            }
        });

        console.log(`도로 파손 마커 ${damageMarkersRef.current.length}개 생성됨`);
    }, [map, damageData]);

    // 지반침하 마커 표시
    useEffect(() => {
        if (!map || !subsidenceData || subsidenceData.length === 0) {
            console.log('지반침하 마커 표시 건너뜀:', { map: !!map, subsidenceData: subsidenceData?.length || 0 });
            return;
        }

        console.log('지반침하 마커 표시 시작:', subsidenceData.length, '건');

        // 기존 지반침하 마커들 제거
        subsidenceMarkersRef.current.forEach(marker => marker.setMap(null));
        subsidenceMarkersRef.current = [];

        subsidenceData.forEach((subsidence, index) => {
            // console.log(`지반침하 데이터 ${index}:`, subsidence);
            
            if (!subsidence.latitude || !subsidence.longitude) {
                console.log(`지반침하 데이터 ${index}: 좌표 없음`);
                return;
            }
            
            try {
                const lat = parseFloat(subsidence.latitude);
                const lng = parseFloat(subsidence.longitude);
                
                // console.log(`지반침하 데이터 ${index} 좌표:`, { lat, lng });
                
                if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                    console.log(`지반침하 데이터 ${index}: 유효하지 않은 좌표`);
                    return;
                }

                const marker = new naver.maps.Marker({
                    position: new naver.maps.LatLng(lat, lng),
                    map,
                    icon: {
                        url: "/media/icon_undergroundSafe.png",
                        size: new naver.maps.Size(32, 32),
                        anchor: new naver.maps.Point(16, 16)
                    },
                    title: `지반침하 - ${subsidence.sido || ''} ${subsidence.sigungu || ''}`
                });

                subsidenceMarkersRef.current.push(marker);
                // console.log(`지반침하 마커 ${index} 생성 성공:`, { lat, lng, sido: subsidence.sido });
            } catch (error) {
                console.error('지반침하 데이터 파싱 오류:', error);
            }
        });

        console.log(`지반침하 마커 ${subsidenceMarkersRef.current.length}개 생성됨`);
    }, [map, subsidenceData]);

    // 경기도 지반침하 마커 표시
    useEffect(() => {
        if (!map || !ggSubsidenceData || ggSubsidenceData.length === 0) return;

        // 기존 경기도 지반침하 마커들 제거
        ggSubsidenceMarkersRef.current.forEach(marker => marker.setMap(null));
        ggSubsidenceMarkersRef.current = [];

        console.log('경기도 지반침하 데이터 처리 시작:', ggSubsidenceData.length, '건');
        
        ggSubsidenceData.forEach((subsidence, index) => {
            // 경기도 데이터는 lat, lng 필드를 사용
            const latValue = subsidence.latitude || subsidence.lat;
            const lngValue = subsidence.longitude || subsidence.lng;
            
            // console.log(`경기도 데이터 ${index}:`, { latValue, lngValue, subsidence });
            
            if (!latValue || !lngValue) {
                console.log(`경기도 데이터 ${index}: 좌표 없음`);
                return;
            }
            
            try {
                const lat = parseFloat(latValue);
                const lng = parseFloat(lngValue);
                
                if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                    console.log(`경기도 데이터 ${index}: 유효하지 않은 좌표`, { lat, lng });
                    return;
                }

                const marker = new naver.maps.Marker({
                    position: new naver.maps.LatLng(lat, lng),
                    map,
                    icon: {
                        url: "/media/icon_sinkhole.png",
                        size: new naver.maps.Size(32, 32),
                        anchor: new naver.maps.Point(16, 16)
                    },
                    title: `경기도 지반침하 - ${subsidence.sido || ''} ${subsidence.sigungu || ''}`
                });

                ggSubsidenceMarkersRef.current.push(marker);
                // console.log(`경기도 지반침하 마커 ${index} 생성 성공:`, { lat, lng, sido: subsidence.sido });
            } catch (error) {
                console.error('경기도 지반침하 데이터 파싱 오류:', error);
            }
        });

        console.log(`경기도 지반침하 마커 ${ggSubsidenceMarkersRef.current.length}개 생성됨`);
    }, [map, ggSubsidenceData]);

    // 파손 및 지반침하 마커 감지 함수
    const checkNearbyDamages = (latitude, longitude) => {
        const WARNING_DISTANCE = 500; // 500미터 내 위험 요소 감지 (테스트를 위해 거리 증가)
        const nearbyDamages = [];

        console.log('위험 요소 감지 시작:', { latitude, longitude, WARNING_DISTANCE });

        // 도로 파손 데이터 확인
        if (damageData && damageData.length > 0) {
        damageData.forEach((damage, index) => {
            if (!damage.roadreport_latlng) return;
            
            try {
                const [damageLng, damageLat] = damage.roadreport_latlng.split(',').map(coord => parseFloat(coord.trim()));
                const distance = getDistance(latitude, longitude, damageLat, damageLng);
                
                if (distance <= WARNING_DISTANCE) {
                        const damageId = `road_${damage.roadreport_num || index}`;
                    if (!announcedDamages.current.has(damageId)) {
                            console.log(`도로 파손 감지: ${Math.round(distance)}m 거리`, damage);
                        nearbyDamages.push({
                            ...damage,
                            distance: Math.round(distance),
                                damageId,
                                type: 'road_damage'
                        });
                    }
                }
            } catch (error) {
                    console.error('도로 파손 데이터 파싱 오류:', error);
                }
            });
        }

        // 지반침하 데이터 확인
        if (subsidenceData && subsidenceData.length > 0) {
            subsidenceData.forEach((subsidence, index) => {
                if (!subsidence.latitude || !subsidence.longitude) return;
                
                try {
                    const lat = parseFloat(subsidence.latitude);
                    const lng = parseFloat(subsidence.longitude);
                    const distance = getDistance(latitude, longitude, lat, lng);
                    
                    if (distance <= WARNING_DISTANCE) {
                        const damageId = `subsidence_${index}`;
                        if (!announcedDamages.current.has(damageId)) {
                            console.log(`지반침하 감지: ${Math.round(distance)}m 거리`, subsidence);
                            nearbyDamages.push({
                                ...subsidence,
                                distance: Math.round(distance),
                                damageId,
                                type: 'subsidence'
                            });
                        }
                    }
                } catch (error) {
                    console.error('지반침하 데이터 파싱 오류:', error);
                }
            });
        }

        // 경기도 지반침하 데이터 확인
        if (ggSubsidenceData && ggSubsidenceData.length > 0) {
            ggSubsidenceData.forEach((subsidence, index) => {
                const latValue = subsidence.latitude || subsidence.lat;
                const lngValue = subsidence.longitude || subsidence.lng;
                
                if (!latValue || !lngValue) return;
                
                try {
                    const lat = parseFloat(latValue);
                    const lng = parseFloat(lngValue);
                    const distance = getDistance(latitude, longitude, lat, lng);
                    
                    if (distance <= WARNING_DISTANCE) {
                        const damageId = `gg_subsidence_${index}`;
                        if (!announcedDamages.current.has(damageId)) {
                            console.log(`경기도 지반침하 감지: ${Math.round(distance)}m 거리`, subsidence);
                            nearbyDamages.push({
                                ...subsidence,
                                distance: Math.round(distance),
                                damageId,
                                type: 'gg_subsidence'
                            });
                        }
                    }
                } catch (error) {
                    console.error('경기도 지반침하 데이터 파싱 오류:', error);
                }
            });
        }

        // 가까운 위험 요소가 있으면 경고 음성 출력
        if (nearbyDamages.length > 0) {
            nearbyDamages.forEach(damage => {
                let warningMessage = '';
                if (damage.type === 'road_damage') {
                const damageType = damage.roadreport_damagetype || '도로 파손';
                    warningMessage = `주의! ${damage.distance}미터 전방에 ${damageType}이 있습니다.`;
                } else if (damage.type === 'subsidence') {
                    warningMessage = `주의! ${damage.distance}미터 전방에 지반침하 위험 지역이 있습니다.`;
                } else if (damage.type === 'gg_subsidence') {
                    warningMessage = `주의! ${damage.distance}미터 전방에 경기도 지반침하 위험 지역이 있습니다.`;
                }
                
                console.log('위험 요소 경고:', warningMessage);
                speak(warningMessage, isVoiceEnabled);
                announcedDamages.current.add(damage.damageId);
            });
        }
    };

    // 테스트용 위치 설정 함수
    const setTestLocation = (lat, lng) => {
        setTestPosition({ latitude: lat, longitude: lng });
        console.log('테스트 위치 설정:', { lat, lng });
        
        // 현재 위치 마커를 테스트 위치로 이동
        const testLocation = new naver.maps.LatLng(lat, lng);
        
        if (!locationMarker.current) {
            // 마커가 없으면 새로 생성
            console.log('현재 위치 마커가 없어서 새로 생성합니다.');
            locationMarker.current = new naver.maps.Marker({
                map,
                position: testLocation,
                icon: {
                    url: "/media/icon_navigation.png",
                    size: new naver.maps.Size(32, 32),
                    anchor: new naver.maps.Point(16, 16)
                },
                title: `현재 위치 (테스트: ${lat.toFixed(6)}, ${lng.toFixed(6)})`
            });
            console.log('새로운 현재 위치 마커 생성됨');
        } else {
            // 마커가 있으면 위치만 변경
            locationMarker.current.setPosition(testLocation);
            locationMarker.current.setTitle(`현재 위치 (테스트: ${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            console.log('현재 위치 마커를 테스트 위치로 이동:', testLocation.toString());
        }
        
        // 지도 중심을 테스트 위치로 이동
        if (map) {
            map.setCenter(testLocation);
            map.setZoom(16);
            console.log('지도 중심을 테스트 위치로 이동:', testLocation.toString());
        } else {
            console.error('map이 null입니다!');
        }
        
        // 현재 위치 상태 업데이트
        setCurrentPosition({ latitude: lat, longitude: lng });
        console.log('현재 위치 상태 업데이트:', { latitude: lat, longitude: lng });
        
        // 테스트 위치에서 위험 요소 감지
        checkNearbyDamages(lat, lng);
        
        console.log('테스트 위치로 현재 위치 마커 이동 완료');
    };

    // 현재 위치 확인 함수
    const checkCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude, accuracy } = position.coords;
                console.log('현재 실제 위치:', { latitude, longitude, accuracy: `${accuracy}m` });
                alert(`현재 위치: 위도 ${latitude.toFixed(6)}, 경도 ${longitude.toFixed(6)}\n정확도: ${Math.round(accuracy)}m`);
            }, (error) => {
                console.error('현재 위치 확인 오류:', error);
                alert('현재 위치를 가져올 수 없습니다.');
            }, {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            });
        } else {
            alert('GPS를 지원하지 않는 브라우저입니다.');
        }
    };

    // 현재 위치 마커 상태 확인 함수
    const checkMarkerStatus = () => {
        console.log('=== 현재 위치 마커 상태 확인 ===');
        console.log('locationMarker.current:', locationMarker.current);
        console.log('map:', map);
        console.log('currentPosition:', currentPosition);
        
        if (locationMarker.current) {
            const position = locationMarker.current.getPosition();
            console.log('마커 현재 위치:', position.toString());
            console.log('마커 제목:', locationMarker.current.getTitle());
        } else {
            console.log('locationMarker.current가 null입니다!');
            console.log('마커를 새로 생성합니다...');
            
            // 마커가 없으면 새로 생성
            if (map && currentPosition) {
                const currentLocation = new naver.maps.LatLng(currentPosition.latitude, currentPosition.longitude);
                locationMarker.current = new naver.maps.Marker({
                    map,
                    position: currentLocation,
                    icon: {
                        url: "/media/icon_navigation.png",
                        size: new naver.maps.Size(32, 32),
                        anchor: new naver.maps.Point(16, 16)
                    },
                    title: `현재 위치 (복구됨)`
                });
                console.log('마커 복구 완료!');
            } else {
                console.log('map 또는 currentPosition이 없어서 마커를 생성할 수 없습니다.');
            }
        }
        
        if (map) {
            const center = map.getCenter();
            console.log('지도 중심:', center.toString());
            console.log('지도 줌 레벨:', map.getZoom());
        } else {
            console.log('map이 null입니다!');
        }
        
        alert(`마커 상태 확인 완료!\n콘솔을 확인하세요.`);
    };

    // GPS 강제 갱신 함수
    const forceGPSUpdate = () => {
        console.log('GPS 강제 갱신 시작');
        if (navigator.geolocation) {
            // 기존 watchPosition 정리
            if (watchId.current) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
            
            // 여러 번 시도하여 가장 정확한 위치 찾기
            let bestPosition = null;
            let attempts = 0;
            const maxAttempts = 3;
            
            const tryGetPosition = () => {
                attempts++;
                console.log(`GPS 시도 ${attempts}/${maxAttempts}`);
                
                navigator.geolocation.getCurrentPosition((position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    console.log(`GPS 시도 ${attempts} 결과:`, { latitude, longitude, accuracy: `${accuracy}m` });
                    
                    // 더 정확한 위치를 찾았거나 첫 번째 시도인 경우
                    if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
                        bestPosition = position;
                        console.log(`더 정확한 위치 발견: ${accuracy}m`);
                    }
                    
                    // 모든 시도 완료 또는 충분히 정확한 위치를 찾은 경우
                    if (attempts >= maxAttempts || accuracy <= 50) {
                        if (bestPosition) {
                            const { latitude, longitude, accuracy } = bestPosition.coords;
                            console.log('최종 GPS 결과:', { latitude, longitude, accuracy: `${accuracy}m` });
                            
                            // 현재 위치 마커 업데이트
                            const currentLocation = new naver.maps.LatLng(latitude, longitude);
                            if (!locationMarker.current) {
                                // 마커가 없으면 새로 생성
                                console.log('GPS 갱신 중 현재 위치 마커가 없어서 새로 생성합니다.');
                                locationMarker.current = new naver.maps.Marker({
                                    map,
                                    position: currentLocation,
                                    icon: {
                                        url: "/media/icon_navigation.png",
                                        size: new naver.maps.Size(32, 32),
                                        anchor: new naver.maps.Point(16, 16)
                                    },
                                    title: `현재 위치 (정확도: ${Math.round(accuracy)}m)`
                                });
                                console.log('GPS 갱신 중 새로운 현재 위치 마커 생성됨');
                            } else {
                                locationMarker.current.setPosition(currentLocation);
                                locationMarker.current.setTitle(`현재 위치 (정확도: ${Math.round(accuracy)}m)`);
                            }
                            
                            // 지도 중심 이동
                            if (map) {
                                map.setCenter(currentLocation);
                                map.setZoom(16);
                            }
                            
                            // 상태 업데이트
                            setCurrentPosition({ latitude, longitude });
                            
                            alert(`GPS 갱신 완료!\n위도: ${latitude.toFixed(6)}\n경도: ${longitude.toFixed(6)}\n정확도: ${Math.round(accuracy)}m\n시도 횟수: ${attempts}회`);
                            
                            // watchPosition 재시작
                            if (routeData) {
                                watchId.current = navigator.geolocation.watchPosition(
                                    (pos) => {
                                        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
                                        const newLocation = new naver.maps.LatLng(lat, lng);
                                        
                                        console.log('WatchPosition 업데이트:', { lat, lng, accuracy: `${acc}m` });
                                        
                                        if (locationMarker.current) {
                                            locationMarker.current.setPosition(newLocation);
                                            locationMarker.current.setTitle(`현재 위치 (정확도: ${Math.round(acc)}m)`);
                                        }
                                        
                                        if (!isDrag.current && map) {
                                            map.setCenter(newLocation);
                                        }
                                        
                                        setCurrentPosition({ latitude: lat, longitude: lng });
                                        checkNearbyDamages(lat, lng);
                                    },
                                    (error) => {
                                        console.error("WatchPosition error:", error);
                                    },
                                    {
                                        enableHighAccuracy: true,
                                        timeout: 20000,
                                        maximumAge: 0
                                    }
                                );
                            }
                        } else {
                            alert('GPS 위치를 가져올 수 없습니다.');
                        }
                    } else {
                        // 다음 시도
                        setTimeout(tryGetPosition, 2000);
                    }
                }, (error) => {
                    console.error(`GPS 시도 ${attempts} 오류:`, error);
                    if (attempts >= maxAttempts) {
                        alert('GPS 갱신에 실패했습니다.');
                    } else {
                        setTimeout(tryGetPosition, 2000);
                    }
                }, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                });
            };
            
            tryGetPosition();
        } else {
            alert('GPS를 지원하지 않는 브라우저입니다.');
        }
    };

    // 테스트용 경기도 고양시 위치들
    const testLocations = [
        { name: '중부대고양캠퍼스', lat: 37.713877, lng: 126.889465 },
        { name: '백석역', lat: 37.6431, lng: 126.7879 },
        { name: '대곡역', lat: 37.6316, lng: 126.8111 },
        { name: '삼송역', lat: 37.6531, lng: 126.8125 },
        { name: '화정역', lat: 37.6344, lng: 126.8328 },
        { name: '일산동구청', lat: 37.6584, lng: 126.7698 },
        { name: '일산서구청', lat: 37.6779, lng: 126.7450 },
        { name: '덕양구청', lat: 37.6336, lng: 126.8325 }
    ];

    const handleGuideClick = (guideItem) => {
        if (!map) return;
        isDrag.current = true;
        const point = path[guideItem.pointIndex];
        map.panTo(new naver.maps.LatLng(point[1], point[0]), {duration: 500});
        map.setZoom(17, true);
    };

    const formatTime = (date) => {
        if (!date || !(date instanceof Date) || isNaN(date)) return '--:--';
        return date.toTimeString().slice(0, 5);
    };

    return (
        <MapContext.Provider value={true}>
            <div style={{display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)'}}>
                {!isSearchCollapsed && (
                    <div style={{padding: '8px 12px', borderBottom: '1px solid #eee'}}>
                        <SearchPlaceBar/>
                    </div>
                )}

                <div className="map-container" style={{flex: 1, position: 'relative', height: '100%'}}>
                    <div id="map" ref={mapRef} style={{width: '100%', height: '100%'}}/>

                    <button
                        className="map-search-toggle"
                        onClick={() => setIsSearchCollapsed(prev => !prev)}
                        style={{position: 'absolute', top: 10, left: 10, zIndex: 1000}}
                    >{isSearchCollapsed ? '검색 열기' : '검색 닫기'}</button>

                    {/* 테스트용 위치 설정 버튼들 */}
                    <div style={{
                        position: 'absolute', 
                        top: 10, 
                        right: 10, 
                        zIndex: 1000, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '3px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '5px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                        <div 
                            style={{
                                fontSize: '10px', 
                                fontWeight: 'bold', 
                                marginBottom: '3px', 
                                color: '#333',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                            onClick={() => setIsTestLocationOpen(!isTestLocationOpen)}
                        >
                            <span>고양시 테스트 위치</span>
                            <span style={{fontSize: '12px'}}>
                                {isTestLocationOpen ? '▼' : '▶'}
                            </span>
                        </div>
                        {isTestLocationOpen && (
                            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                                <button
                                    onClick={checkCurrentLocation}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '10px',
                                        backgroundColor: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    현재 위치 확인
                                </button>
                                <button
                                    onClick={checkMarkerStatus}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '10px',
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    마커 상태 확인
                                </button>
                                <button
                                    onClick={forceGPSUpdate}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '10px',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    GPS 강제 갱신
                                </button>
                                <button
                                    onClick={() => setTestLocation(37.713877, 126.889465)}
                                    style={{
                                        padding: '3px 8px',
                                        fontSize: '10px',
                                        backgroundColor: '#ffc107',
                                        color: 'black',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    중부대로 이동
                                </button>
                                {testLocations.map((location, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setTestLocation(location.lat, location.lng)}
                                        style={{
                                            padding: '3px 8px',
                                            fontSize: '10px',
                                            backgroundColor: '#E81E24',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {location.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {routeData && (
                        <div className={`direction-bottom-sheet ${isSheetOpen ? 'open' : ''}`}>
                            <div className="sheet-header" onClick={() => setIsSheetOpen(!isSheetOpen)}>
                                <div className="sheet-handle"/>
                                <div className="sheet-title">
                                    <div className="instruction">{currentInstruction}</div>
                                    <div className="meta">
                                        <span>{distance ? `${(distance / 1000).toFixed(1)}km` : 'N/A'}</span>
                                        <span> · </span>
                                        <span>{duration ? `${Math.floor(duration / 60000)}분` : 'N/A'}</span>
                                        <span> · </span>
                                        <span>도착 {departureTime && duration ? formatTime(new Date(new Date(departureTime).getTime() + duration)) : 'N/A'}</span>
                                    </div>
                                </div>
                                <button className={`voice-toggle ${isVoiceEnabled ? 'on' : 'off'}`} onClick={(e) => { e.stopPropagation(); setIsVoiceEnabled(!isVoiceEnabled); }}>
                                    <img src={isVoiceEnabled ? "/media/icon_volume_on.png" : "/media/icon_volume_off.png"} alt="voice"/>
                                </button>
                            </div>
                            {isSheetOpen && (
                                <div className="sheet-body">
                                    {guide.map((place, index) => (
                                        <div
                                            key={index}
                                            className={`guide-row ${index === nextGuideIndex ? 'active' : ''}`}
                                            onClick={() => handleGuideClick(place)}
                                        >
                                            <div className="guide-index">{index + 1}</div>
                                            <div className="guide-texts">
                                                <div className="primary">{place.distance ? `${Math.ceil(place.distance / 10) * 10}m 후 ` : ''}{place.instructions}</div>
                                                <div className="secondary">{place.duration ? `${Math.ceil(place.duration / 1000)}초` : ''}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </MapContext.Provider>
    );
};

export default Direction;