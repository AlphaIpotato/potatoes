import React, {useState} from "react";
import {Card, Container, Row, Col, Form, Button, Alert, Spinner} from "react-bootstrap";
import {Link, useNavigate} from "react-router-dom";

function UserLogin({ embedded = false }) {
    const apiBase = "http://localhost:8000";
    const navigate = useNavigate();

    const [mode, setMode] = useState("user"); // 'user' | 'admin'
    const [form, setForm] = useState({ user_id: "", user_pw: "", master_id: "", master_pw: "" });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const clickSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const idField = mode === "admin" ? "master_id" : "user_id";
        const pwField = mode === "admin" ? "master_pw" : "user_pw";
        if (!form[idField] || !form[pwField]) {
            setError("아이디와 비밀번호를 입력하세요.");
            return;
        }
        setSubmitting(true);
        try {
            // 백엔드 로그인 엔드포인트(제공 스펙 반영)
            const baseEndpoint = mode === "admin" ? "/master/login" : "/users/login";
            const endpoints = [baseEndpoint, `${baseEndpoint}/`];
            const payload = mode === "admin" ?
                { master_id: (form.master_id||"").trim(), master_pw: (form.master_pw||"").trim() } :
                { user_id: (form.user_id||"").trim(), user_pw: (form.user_pw||"").trim() };

            let response;
            for (const ep of endpoints) {
                response = await fetch(`${apiBase}${ep}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (response.ok) break;
                // 404/405 시 다음 후보 엔드포인트로 재시도
                if (![404, 405].includes(response.status)) break;
            }
            if (!response || !response.ok) {
                const text = await response.text();
                throw new Error(text || "로그인 실패");
            }
            const data = await response.json();
            
            // sessionStorage에 사용자 정보 저장 (사이드바에서 사용)
            if (mode === 'admin') {
                sessionStorage.setItem('user_id', data.master_id || form.master_id);
                sessionStorage.setItem('user_role', 'admin');
                sessionStorage.setItem('user_name', data.master_name || '관리자');
            } else {
                sessionStorage.setItem('user_id', data.user_id || form.user_id);
                sessionStorage.setItem('user_role', 'user');
                sessionStorage.setItem('user_name', data.user_name || data.name || '회원');
            }
            
            // localStorage에도 저장 (기존 로직 유지)
            const normalized = mode === 'admin' ? {
                token: data.token || data.access || null,
                role: 'admin',
                user: { user_id: data.master_id || form.master_id, user_name: data.master_name || '관리자' }
            } : {
                token: data.token || data.access || null,
                role: 'user',
                user: { user_id: data.user_id || form.user_id, user_name: data.user_name || data.name || '회원' }
            };
            localStorage.setItem("dorosee_auth", JSON.stringify(normalized));
            
            // 사이드바 갱신을 위한 페이지 새로고침
            window.location.href = mode === "admin" ? "/dorosee" : "/dorosee/user/info";
        } catch (err) {
            setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    const loginForm = (
        <Form onSubmit={clickSubmit}>
            <div className="mb-3 d-flex justify-content-center align-items-center gap-3">
                <span className={`login-switch-label ${mode === 'user' ? 'active' : ''}`}>회원</span>
                <div className="toggle">
                    <input
                        id="login-mode-toggle"
                        className="toggle-input"
                        type="checkbox"
                        checked={mode === 'admin'}
                        onChange={(e) => setMode(e.target.checked ? 'admin' : 'user')}
                    />
                    <label htmlFor="login-mode-toggle" className="toggle-slider" />
                </div>
                <span className={`login-switch-label ${mode === 'admin' ? 'active' : ''}`}>관리자</span>
            </div>
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
            {mode === 'user' ? (
                <>
                    <Form.Group controlId="formUserId">
                        <Form.Label>회원 아이디</Form.Label>
                        <Form.Control type="text" name="user_id" value={form.user_id} onChange={onChange} placeholder="아이디 입력" autoFocus={true}/>
                    </Form.Group>
                    <Form.Group controlId="formUserPw" className="mt-3">
                        <Form.Label>비밀번호</Form.Label>
                        <Form.Control type="password" name="user_pw" value={form.user_pw} onChange={onChange} placeholder="비밀번호 입력"/>
                    </Form.Group>
                </>
            ) : (
                <>
                    <Form.Group controlId="formMasterId">
                        <Form.Label>관리자 아이디</Form.Label>
                        <Form.Control type="text" name="master_id" value={form.master_id} onChange={onChange} placeholder="관리자 아이디 입력" autoFocus={true}/>
                    </Form.Group>
                    <Form.Group controlId="formMasterPw" className="mt-3">
                        <Form.Label>관리자 비밀번호</Form.Label>
                        <Form.Control type="password" name="master_pw" value={form.master_pw} onChange={onChange} placeholder="비밀번호 입력"/>
                    </Form.Group>
                </>
            )}

            <Button variant="primary" type="submit" className="mt-4 w-100" disabled={submitting}>
                {submitting ? (<><Spinner size="sm" animation="border" className="me-2"/>로그인 중...</>) : "로그인"}
            </Button>
            {!embedded && (
                <>
                    <hr/>
                    <div className="d-flex justify-content-between">
                        <Link to="/dorosee/user/register">회원가입</Link>
                        <Link to="/dorosee/user/findaccount">계정 찾기</Link>
                    </div>
                </>
            )}
        </Form>
    );

    if (embedded) {
        return loginForm;
    }

    return (
        <Container fluid className="mt-5">
            <Row className="justify-content-md-center">
                <Col md={6}>
                    <Card className="p-4">
                        <h3 className="mb-4">로그인</h3>
                        {loginForm}
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default UserLogin;
