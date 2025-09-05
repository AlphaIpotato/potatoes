import React from "react";
import {useNavigate} from "react-router-dom";

const NaviButton = ({label, start, goal, pathTo}) => {
    const url = "http://10.97.30.236:8000";
    const navigate = useNavigate();

    const handleClick = async (event) => {
        event.preventDefault();

        try {
            const response = await fetch(`${url}/naver/proxy/?start=${start}&goal=${goal}`, {
                method: "GET",
            });

            if (response.ok) {
                const data = await response.json();
                console.log("NaviButton 데이터:", data);

                if (data.route?.trafast?.[0]?.path) {
                    navigate(pathTo, {state: {fetchedData: data}});
                } else {
                    console.error("길찾기 데이터 없음");
                }
            } else {
                console.error("요청 실패:", response.statusText);
            }
        } catch (error) {
            console.error("요청 중 오류 발생:", error);
        }
    };

    return (
        <button className="btn-primary-app" onClick={handleClick}>
            <span>{label}</span>
        </button>
    );
};

export default NaviButton;
