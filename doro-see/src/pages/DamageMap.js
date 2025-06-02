import React, {useEffect, useRef} from "react";
import {useLocation} from "react-router-dom";
import {MapContext} from './MapContext';

function DamageMap() {
    const url = "http://localhost:8000";
    if (!window.naver) return;
    const {naver} = window;

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const location = useLocation();

    const road_data = location.state?.fetchedData || [];
    const filteredData = road_data.filter(road => road.roadreport_image);

    useEffect(() => {
        const map = new naver.maps.Map(mapRef.current, {
            center: new naver.maps.LatLng(36.320284, 127.998343),
            zoom: 7,
            minZoom: 7,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT,
            },
        });

        map.setOptions("mapTypeControl", true);
        naver.maps.Event.addListener(map, "zoom_changed", (zoom) => {
            // console.log("zoom:", zoom);
        });

        naver.maps.Event.once(map, "init", () => {
            console.log("지도 초기화 완료");
        });

        mapInstance.current = map;

        filteredData.forEach((road) => {
            (road.roadreport_latlng)
            if (road.roadreport_latlng) {
                const [lng, lat] = road.roadreport_latlng.split(",").map(coord => parseFloat(coord.trim()));

                const iconType = road.roadreport_damagetype.includes("pothole")
                    ? "/media/icon_pothole.png"
                    : "/media/icon_crack.png";

                new naver.maps.Marker({
                    position: new naver.maps.LatLng(lng, lat),
                    map: map,
                    icon: {
                        url: iconType,
                        size: new naver.maps.Size(32, 32),
                        origin: new naver.maps.Point(0, 0),
                        anchor: new naver.maps.Point(16, 16)
                    }
                });
            }
        });

    }, [filteredData]);
    return (
        <>
            <MapContext.Provider value={true}>
                <div className="map-container">
                    <div id="map" ref={mapRef}></div>
                </div>
            </MapContext.Provider>
        </>
    );
}

export default DamageMap;
