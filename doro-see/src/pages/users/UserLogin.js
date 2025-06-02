import React from "react";
import {Card, Container, Row, Col, Form, Button} from "react-bootstrap";
import {Link} from "react-router-dom";

function UserLogin() {

    
    // 이거 만드는 중
    const clickSubmit = async (e) => {
        if (e.key === "Enter" && inputStart !== "") {
            try {
                const response = await fetch(`url/naver/search/?query=${inputStart}`, {
                    method: "GET",
                });

                if (response.ok) {
                    const data = await response.json();
                    setPlaceData(data.items);
                    setActiveInput("start");
                } else {
                    console.error("요청 실패:", response.statusText);
                }
            } catch (error) {
                console.error("요청 중 오류 발생:", error);
            }
        }
    };

    return (
        <Container fluid className="mt-5">
            <Row className="justify-content-md-center">
                <Col md={6}>
                    <Card className="p-4">
                        <h3 className="mb-4">로그인</h3>
                        <Form>
                            <Form.Group controlId="formBasicEmail">
                                <Form.Label>아이디</Form.Label>
                                <Form.Control type="id" placeholder="아이디 입력" autoFocus={`True`}/>
                            </Form.Group>

                            <Form.Group controlId="formBasicPassword" className="mt-3">
                                <Form.Label>비밀번호</Form.Label>
                                <Form.Control type="password" placeholder="비밀번호 입력"/>
                            </Form.Group>

                            <Button variant="primary" type="submit" className="mt-4 w-100"
                                    onClick={clickSubmit}>
                                로그인
                            </Button>
                            <hr/>
                            <div className="d-flex justify-content-between">
                                <Link to="/dorosee/user/register">회원가입</Link>
                                <Link to="/dorosee/user/findaccount">계정 찾기</Link>
                            </div>
                        </Form>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default UserLogin;
