import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

function DoroseeLoader() {
    const url = "http://10.120.193.236:8000";
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchDataAndNavigate() {
            try {
                const [roadResponse, ggResponse, ssResponse] = await Promise.all([
                    fetch(`${url}/roadreport/all`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    }),
                    fetch(`${url}/gg/subsidence/`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    }),
                    fetch(`${url}/api/subsidence/coords/`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    })
                ]);

                if (roadResponse.ok && ggResponse.ok && ssResponse.ok) {
                    const roadData = await roadResponse.json();
                    const ggData = await ggResponse.json();
                    const ssData = await ssResponse.json();
                    console.log("도로파손 데이터:", roadData);
                    console.log("지반침하 데이터:", ggData);
                    console.log("지하안전정보 데이터:", ssData);

                    navigate(`/dorosee`, {
                        state: {
                            roadData: roadData,
                            ggData: ggData,
                            ssData: ssData
                        }
                    });
                } else {
                    console.error("하나 이상의 요청 실패:", roadResponse.statusText, ggResponse.statusText, ssResponse.statusText);
                    navigate(`/dorosee`);
                }

            } catch (error) {
                console.error("요청 중 오류 발생:", error);
                navigate(`/dorosee`);
            }
        }

        fetchDataAndNavigate();
    }, [navigate]);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '70vh',
            fontSize: '24px',
            fontWeight: 'bold'
        }}>
            로딩 중...
        </div>
    );
}

export default DoroseeLoader;
