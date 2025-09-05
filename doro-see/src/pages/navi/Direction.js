import React, {useEffect, useRef, useState} from "react";
import {useLocation} from "react-router-dom";
import {MapContext} from '../MapContext';
import SearchPlaceBar from "../../components/SearchPlaceBar";

// Haversine formula to calculate distance between two lat-lng points
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

// Text-to-speech function
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

    // 파손 데이터 가져오기
    useEffect(() => {
        const fetchDamageData = async () => {
            try {
                const response = await fetch('http://10.97.30.236:8000/roadreport/all', {
                    headers: {'Content-Type': 'application/json'}
                });
                if (response.ok) {
                    const data = await response.json();
                    setDamageData(data);
                    console.log('파손 데이터 로드됨:', data.length, '건');
                }
            } catch (error) {
                console.error('파손 데이터 로드 실패:', error);
            }
        };
        fetchDamageData();
    }, []);

    useEffect(() => {
        if (!window.naver || map) return;
        const {naver} = window;

        const mapInstanceRef = new naver.maps.Map(mapRef.current, {
            center: new naver.maps.LatLng(37.5665, 126.9780),
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
                navigator.geolocation.getCurrentPosition((pos) => {
                    const newLocation = new naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                    mapInstanceRef.setCenter(newLocation);
                    
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
                        title: "현재 위치"
                    });
                }, (error) => {
                    console.error("위치 정보를 가져올 수 없습니다:", error);
                    alert("위치 정보를 가져올 수 없습니다. GPS가 활성화되어 있는지 확인해주세요.");
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
                const {latitude, longitude} = position.coords;
                const currentLocation = new naver.maps.LatLng(latitude, longitude);

                if (!locationMarker.current) {
                    locationMarker.current = new naver.maps.Marker({
                        map,
                        position: currentLocation,
                        icon: {
                            url: "/media/icon_navigation.png",
                            size: new naver.maps.Size(32, 32),
                            anchor: new naver.maps.Point(16, 16)
                        }
                    });
                } else {
                    locationMarker.current.setPosition(currentLocation);
                }

                if (!isDrag.current) map.setCenter(currentLocation);

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
                setCurrentInstruction("위치 정보를 가져올 수 없습니다.");
            },
            {enableHighAccuracy: true, timeout: 5000, maximumAge: 0}
        );

        return () => {
            if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
            if (currentLocationMarker.current) currentLocationMarker.current.setMap(null);
            window.speechSynthesis.cancel();
        };
    }, [map, routeData, nextGuideIndex, isVoiceEnabled, damageData]);

    // 파손 마커 감지 함수
    const checkNearbyDamages = (latitude, longitude) => {
        if (!damageData || damageData.length === 0) return;

        const WARNING_DISTANCE = 100; // 100미터 내 파손 감지
        const nearbyDamages = [];

        damageData.forEach((damage, index) => {
            if (!damage.roadreport_latlng) return;
            
            try {
                const [damageLng, damageLat] = damage.roadreport_latlng.split(',').map(coord => parseFloat(coord.trim()));
                const distance = getDistance(latitude, longitude, damageLat, damageLng);
                
                if (distance <= WARNING_DISTANCE) {
                    const damageId = `${damage.roadreport_num || index}`;
                    if (!announcedDamages.current.has(damageId)) {
                        nearbyDamages.push({
                            ...damage,
                            distance: Math.round(distance),
                            damageId
                        });
                    }
                }
            } catch (error) {
                console.error('파손 데이터 파싱 오류:', error);
            }
        });

        // 가까운 파손이 있으면 경고 음성 출력
        if (nearbyDamages.length > 0) {
            nearbyDamages.forEach(damage => {
                const damageType = damage.roadreport_damagetype || '도로 파손';
                const distance = damage.distance;
                const warningMessage = `주의! ${distance}미터 전방에 ${damageType}이 있습니다.`;
                
                console.log('파손 경고:', warningMessage);
                speak(warningMessage, isVoiceEnabled);
                announcedDamages.current.add(damage.damageId);
            });
        }
    };

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