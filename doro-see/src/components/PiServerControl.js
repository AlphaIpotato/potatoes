import React, {useState} from 'react';

const PiServerControl = () => {
    const [isOn, setIsOn] = useState(false);

    const piServerControlUrl = 'http://10.120.193.194:5000/control';

    // const fallbackUrl = 'http://192.168.0.135:5000/control';
    // const fallbackUrl = 'http://10.56.194.194:5000/control';
    const fallbackUrl = 'http://10.120.193.194:5000/control';

    async function sendControlCommand(command, piServerControlUrl) {
        console.log(`Sending command: '${command}' to ${piServerControlUrl}`);

        try {
            const response = await fetch(piServerControlUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                },
                body: command
            });

            const result = await response.json();

            if (response.ok) {
                console.log('hard camera click:', result);
            } else {
                console.error('hard camera click error:', response.status, result);
            }

            return result;

        } catch (error) {
            console.error('Failed to send command due to network or other error:', error);

            try {
                const response = await fetch(fallbackUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                    body: command
                });

                const result = await response.json();

                if (response.ok) {
                    console.log('hard camera click:', result);
                } else {
                    console.error('hard camera click error:', response.status, result);
                }

                return result;

            } catch (error) {
                console.error('Failed to send command due to network or other error:', error);
            }
        }
    }

    function handleButtonClick() {
        const nextCommand = isOn ? 'off' : 'on';

        sendControlCommand(nextCommand, piServerControlUrl)
            .then(response => {
                if (response) {
                    console.log(`Handling '${nextCommand}' response:`, response);
                    setIsOn(!isOn);
                }
            });
    }

    return (
        <div>
            <button
                className="PiServerControlBtn"
                onClick={handleButtonClick}
                style={{
                    fontSize: "16px",
                    borderRadius: "5px",
                    border: "transparent",
                    backgroundColor: isOn ? "#f44336" : "#4caf50",
                    color: "white",
                }}
            >
                {isOn ? "전송 중지" : "데이터 전송"}
            </button>
        </div>
    );
};

export default PiServerControl;
