import { useState, useEffect } from "react";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";

export default function App() {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Kiểm tra xem bà đã đăng nhập trước đó chưa
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setUser(savedUser);
    }
    // Giả lập quả cầu tím quay 1.5 giây cho đúng chất "Định Mệnh"
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Màn hình chờ với hiệu ứng u ám
  if (loading) {
    return (
      <div style={{height:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',background:'#000',fontFamily:'sans-serif'}}>
        <div style={{fontSize:60, marginBottom:20, filter:'drop-shadow(0 0 10px #6c5ce7)'}}>🔮</div>
        <div style={{color:'#6c5ce7', fontWeight:'bold', letterSpacing:3, fontSize:14}}>ĐANG KẾT NỐI TÂM GIAO...</div>
        <div style={{marginTop:10, width:100, height:2, background:'#111', overflow:'hidden', borderRadius:5}}>
          <div style={{width:'50%', height:'100%', background:'#6c5ce7', animation:'loading 1s infinite ease-in-out'}}></div>
        </div>
        <style>{`@keyframes loading { 0% { margin-left: -50%; } 100% { margin-left: 100%; } }`}</style>
      </div>
    );
  }

  // Điều hướng: Nếu chưa có user thì hiện màn hình đăng nhập, có rồi thì vào Chat
  return user ? <ChatPage /> : <AuthPage />;
}
