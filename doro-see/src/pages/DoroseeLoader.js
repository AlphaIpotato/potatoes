import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

function DoroseeLoader() {
    const url = "http://192.168.0.146:8000";
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchDataAndNavigate() {
            try {
                const [roadResponse, ggResponse] = await Promise.all([
                    fetch(`${url}/roadreport/all`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    }),
                    fetch(`${url}/ggdata?service=Tgrdsubsidinfo&pIndex=1&pSize=316`, {
                        method: "GET",
                        headers: {'Content-Type': 'application/json'},
                    })
                ]);

                if (roadResponse.ok && ggResponse.ok) {
                    const roadData = await roadResponse.json();
                    const ggData = await ggResponse.json();
                    console.log("도로파손 데이터:", roadData);
                    console.log("지반침하 데이터:", ggData);

                    // 두 데이터를 함께 전달
                    navigate(`/dorosee`, {
                        state: {
                            fetchedData: roadData,
                            ggData: ggData
                        }
                    });
                } else {
                    console.error("하나 이상의 요청 실패:", roadResponse.statusText, ggResponse.statusText);
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
            height: '100vh',
            fontSize: '24px'
        }}>
            로딩 중...
        </div>
    );
}

export default DoroseeLoader;
