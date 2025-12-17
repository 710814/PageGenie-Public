// 임시 테스트: 최소한의 컴포넌트로 렌더링 확인
import React from 'react';

const TestApp: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: '#333' }}>테스트 화면</h1>
      <p>React가 정상적으로 작동하고 있습니다.</p>
    </div>
  );
};

export default TestApp;

