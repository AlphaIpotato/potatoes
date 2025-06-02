import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

function DoroseeLoader() {
    const url = "http://localhost:8000";
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchDataAndNavigate() {
            try {
                const response = await fetch(`${url}/roadreport/all`, {
                    method: "GET",
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log("damagemap 데이터:", data);
                    navigate(`/dorosee`, {state: {fetchedData: data}});
                } else {
                    console.error("요청 실패:", response.statusText);
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
