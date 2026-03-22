import { useState, useEffect, useRef } from 'react';

export default function ChatPage() {
  const [msg, setMsg] = useState('');
  const [list, setList] = useState<any[]>([]);
  const userID = localStorage.getItem('current_user');
  const end = useRef<any>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [list]);

  const send = () => {
    if(!msg.trim()) return;
    const newMsgs = [...list, { role: 'user', text: msg }];
    setList(newMsgs);
    setMsg('');
    // Giả lập trả lời
    setTimeout(() => {
      setList([...newMsgs, { role: 'bot', text: 'Linh hồn đang lắng nghe bà... (API chưa kết nối)' }]);
    }, 1000);
  };

  return (
    <div style={{height:'100vh', display:'flex', flexDirection:'column', background:'#f0f2f5', fontFamily:'sans-serif'}}>
      {/* Header kiểu Facebook */}
      <div style={{padding:'10px 20px', background:'#2d1b4e', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 5px rgba(0,0,0,0.2)'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:40, height:40, borderRadius:'50%', background:'#fff', color:'#2d1b4e', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold'}}>ID</div>
          <div>
            <div style={{fontSize:14, fontWeight:'bold'}}>Người dùng: {userID}</div>
            <div style={{fontSize:10, color:'#a29bfe'}}>Đang hoạt động</div>
          </div>
        </div>
        <button onClick={()=>{localStorage.removeItem('current_user'); window.location.reload();}} style={{background:'none', border:'1px solid #6c5ce7', color:'#fff', borderRadius:8, padding:'5px 10px', fontSize:12}}>Đăng xuất</button>
      </div>

      {/* Khung Chat */}
      <div style={{flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:15}}>
        {list.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            <div style={{ 
              padding: '12px 16px', borderRadius: 20, fontSize: 14,
              background: m.role === 'user' ? '#6c5ce7' : '#fff',
              color: m.role === 'user' ? '#fff' : '#000',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {/* Input */}
      <div style={{padding:15, background:'#fff', display:'flex', gap:10, borderTop:'1px solid #ddd'}}>
        <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
          placeholder="Viết tin nhắn..." style={{flex:1, padding:12, borderRadius:25, border:'1px solid #ddd', background:'#f0f2f5', outline:'none'}} />
        <button onClick={send} style={{width:45, height:45, borderRadius:'50%', background:'#2d1b4e', color:'#fff', border:'none', fontSize:18}}>➔</button>
      </div>
    </div>
  );
}
