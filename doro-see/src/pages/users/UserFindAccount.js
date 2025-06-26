import React from "react";
import {Card, Container, Row, Col, Form, Button} from "react-bootstrap";

function UserRegister() {
    return (
        <Container fluid className="mt-5">
            <Row className="justify-content-md-center">
                <Col md={6}>
                    <Card className="p-4">
                        <h3 className="mb-4">ID/PW 찾기</h3>
                        <Form>
                            <Form.Group controlId="formName">
                                <Form.Label>이름</Form.Label>
                                <Form.Control type="text" placeholder="이름 입력"/>
                            </Form.Group>

                            <Form.Group controlId="formEmail" className="mt-3">
                                <Form.Label>이메일</Form.Label>
                                <Form.Control type="email" placeholder="이메일 입력"/>
                            </Form.Group>

                            <Form.Group controlId="formPassword" className="mt-3">
                                <Form.Label>비밀번호</Form.Label>
                                <Form.Control type="password" placeholder="비밀번호 입력"/>
                            </Form.Group>

                            <Form.Group controlId="formConfirmPassword" className="mt-3">
                                <Form.Label>비밀번호 확인</Form.Label>
                                <Form.Control type="password" placeholder="비밀번호 재입력"/>
                            </Form.Group>

                            <Button variant="success" type="submit" className="mt-4 w-100">
                                회원가입
                            </Button>
                        </Form>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default UserRegister;
