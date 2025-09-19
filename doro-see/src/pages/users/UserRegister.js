import React, {useState} from "react";
import {Card, Container, Row, Col, Form, Button, Alert, Spinner} from "react-bootstrap";
import {useNavigate} from "react-router-dom";

function UserRegister({ embedded = false }) {
    const apiBase = "http://10.120.193.236:8000";
    const navigate = useNavigate();
    const [role, setRole] = useState("user"); // 'user' | 'admin'
    const [form, setForm] = useState({
        user_id: "",
        user_name: "",
        user_pw: "",
        user_age: "",
        user_phonenumber: "",
        master_id: "",
        master_name: "",
        master_pw: "",
        master_phonenumber: "",
    });
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const onChange = (e) => {
        const {name, value} = e.target;
        setForm(prev => ({...prev, [name]: value}));
    };

    const submitRegister = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            let res;
            if (role === "admin") {
                res = await fetch(`${apiBase}/master/signup`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        master_id: form.master_id,
                        master_pw: form.master_pw,
                        master_name: form.master_name,
                        master_phonenumber: form.master_phonenumber,
                        master_grade: "9"
                    })
                });
            } else {
                res = await fetch(`${apiBase}/users/signup`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        user_id: form.user_id,
                        user_pw: form.user_pw,
                        user_name: form.user_name,
                        user_age: form.user_age ? Number(form.user_age) : null,
                        user_phonenumber: form.user_phonenumber
                    })
                });
            }

            if (!res.ok) {
                // 백엔드 에러 메시지를 받아서 throw
                const errorData = await res.json();
                throw new Error(errorData.error || JSON.stringify(errorData));
            }

            alert("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
            navigate("/dorosee/user/login");
        } catch (err) {
            setError(err.message || '회원가입에 실패했습니다. 입력값을 확인해주세요.');
        } finally {
            setSubmitting(false);
        }
    };

    const registerForm = (
        <Form onSubmit={submitRegister}>
            {/* 역할 선택 토글 */}
            <div className="mb-3 d-flex justify-content-center align-items-center gap-3">
                <span className={`login-switch-label ${role === 'user' ? 'active' : ''}`}>회원</span>
                <div className="toggle">
                    <input
                        id="register-role-toggle"
                        className="toggle-input"
                        type="checkbox"
                        checked={role === 'admin'}
                        onChange={(e) => setRole(e.target.checked ? 'admin' : 'user')}
                    />
                    <label htmlFor="register-role-toggle" className="toggle-slider" />
                </div>
                <span className={`login-switch-label ${role === 'admin' ? 'active' : ''}`}>관리자</span>
            </div>

            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

            {role === 'admin' ? (
                <>
                    <Form.Group controlId="formMasterId">
                        <Form.Label>관리자 아이디</Form.Label>
                        <Form.Control 
                            type="text" 
                            name="master_id" 
                            value={form.master_id}
                            onChange={onChange} 
                            placeholder="관리자 아이디 입력"
                            autoFocus={true}
                        />
                    </Form.Group>
                    <Form.Group controlId="formMasterName" className="mt-3">
                        <Form.Label>관리자 이름</Form.Label>
                        <Form.Control 
                            type="text" 
                            name="master_name" 
                            value={form.master_name}
                            onChange={onChange} 
                            placeholder="이름 입력"
                        />
                    </Form.Group>
                    <Form.Group controlId="formMasterPhone" className="mt-3">
                        <Form.Label>전화번호 (선택)</Form.Label>
                        <Form.Control 
                            type="tel" 
                            name="master_phonenumber"
                            value={form.master_phonenumber} 
                            onChange={onChange}
                            placeholder="전화번호 입력"
                        />
                    </Form.Group>
                    <Form.Group controlId="formMasterPw" className="mt-3">
                        <Form.Label>비밀번호</Form.Label>
                        <Form.Control 
                            type="password" 
                            name="master_pw" 
                            value={form.master_pw}
                            onChange={onChange} 
                            placeholder="비밀번호 입력"
                        />
                    </Form.Group>
                </>
            ) : (
                <>
                    <Form.Group controlId="formUserId">
                        <Form.Label>회원 아이디</Form.Label>
                        <Form.Control 
                            type="text" 
                            name="user_id" 
                            value={form.user_id}
                            onChange={onChange} 
                            placeholder="아이디 입력"
                            autoFocus={true}
                        />
                    </Form.Group>
                    <Form.Group controlId="formUserName" className="mt-3">
                        <Form.Label>이름</Form.Label>
                        <Form.Control 
                            type="text" 
                            name="user_name" 
                            value={form.user_name}
                            onChange={onChange} 
                            placeholder="이름 입력"
                        />
                    </Form.Group>
                    <Form.Group controlId="formUserAge" className="mt-3">
                        <Form.Label>나이</Form.Label>
                        <Form.Control 
                            type="number" 
                            name="user_age" 
                            value={form.user_age}
                            onChange={onChange} 
                            placeholder="나이 입력" 
                            min="1" 
                            max="120"
                        />
                    </Form.Group>
                    <Form.Group controlId="formUserPhone" className="mt-3">
                        <Form.Label>전화번호 (선택)</Form.Label>
                        <Form.Control 
                            type="tel" 
                            name="user_phonenumber" 
                            value={form.user_phonenumber}
                            onChange={onChange} 
                            placeholder="전화번호 입력"
                        />
                    </Form.Group>
                    <Form.Group controlId="formUserPw" className="mt-3">
                        <Form.Label>비밀번호</Form.Label>
                        <Form.Control 
                            type="password" 
                            name="user_pw" 
                            value={form.user_pw}
                            onChange={onChange} 
                            placeholder="비밀번호 입력"
                        />
                    </Form.Group>
                </>
            )}

            <Button variant="primary" type="submit" className="mt-4 w-100" disabled={submitting}>
                {submitting ? (<><Spinner size="sm" animation="border" className="me-2"/>회원가입 중...</>) : "회원가입"}
            </Button>
        </Form>
    );

    if (embedded) {
        return registerForm;
    }

    return (
        <Container fluid className="mt-5">
            <Row className="justify-content-md-center">
                <Col md={6}>
                    <Card className="p-4">
                        <h3 className="mb-4">회원가입</h3>
                        {registerForm}
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default UserRegister;