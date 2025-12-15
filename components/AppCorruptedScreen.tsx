import React from 'react';

const AppCorruptedScreen: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-red-900 text-red-100 p-4">
      <div className="text-center">
        <svg className="w-24 h-24 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 className="text-4xl font-bold font-orbitron">LỖI NGHIÊM TRỌNG</h1>
        <p className="mt-4 text-lg text-red-200">
          Tệp tin hệ thống quan trọng đã bị thiếu hoặc bị thay đổi.
        </p>
        <p className="mt-2 text-red-300">
          Ứng dụng không thể khởi động để đảm bảo an toàn. Vui lòng không sửa đổi các tệp tin cốt lõi của ứng dụng.
        </p>
        <div className="mt-6 p-4 bg-red-800/50 border border-red-700 rounded-md">
            <p className="font-mono text-sm text-red-200">ERROR_CODE: TAMPER_DETECTED_0xDEADBEEF</p>
            <p className="font-mono text-sm text-red-200">FILE_REF: bugerror.ts</p>
        </div>
      </div>
    </div>
  );
};

export default AppCorruptedScreen;