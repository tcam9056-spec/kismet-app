import { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Avatar, Modal, List, message } from 'antd';
import { SendOutlined, EyeOutlined, KeyOutlined, LogoutOutlined, FireOutlined } from '@ant-design/icons';
import { sendMessage, saveMessageToDb } from '../gemini';

export default function AppSoul() {
  const [k, setK] = useState('');
  const [isL, setIsL] = useState(false);
  const [chars, setChars] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [inpt, setInpt] = useState('');
  const [vP, setVP] = useState(false);
  const endR = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    const sK = localStorage.getItem('gemini_api_key'); if(sK){setK(sK);setIsL(true);}
    setChars(JSON.parse(localStorage.getItem('gemini_characters')||'[]'));
  }, []);
  useEffect(() => { endR.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const onL = () => { if(k.trim()){localStorage.setItem('gemini_api_key', k);setIsL(true);message.success('Linh hồn đã thắp sáng!');} };
  const onOut = () => { localStorage.removeItem('gemini_api_key');setIsL(false);setK(''); };

  const onS = async () => {
    if(!inpt.trim()||!k||!sel) return;
    const uM = { role: 'user', content: inpt }; setMsgs(p => [...p, uM]); setInpt('');
    await saveMessageToDb(sel.id, 'user', inpt);
    try {
      const res = await sendMessage(k, {id:'gemini-1.5-flash'}, sel.systemPrompt, msgs, inpt);
      const aM = { role: 'model', content: res }; setMsgs(p => [...p, aM]);
      await saveMessageToDb(sel.id, 'model', res);
    } catch (e) { 
      message.error('LINH HỒN ĐÃ TẮT! Kiểm tra chìa khóa ngay.');
      setMsgs(p => [...p, { role:'model', content:'Linh hồn tạm tắt. Hãy thắp sáng lại chìa khóa.' }]); 
    }
  };

  if (!isL) return (
    <div style={{height:'100vh',display:'flex',justifyContent:'center',alignItems:'center',background:'#050505'}}>
      <Card style={{width:320,borderRadius:25,textAlign:'center',background:'#111',border:'1px solid #222',boxShadow:'0 0 20px #6c5ce733'}}>
        <Avatar size={64} icon={<FireOutlined />} style={{background:'linear-gradient(45deg,#6c5ce7,#a29bfe)',marginBottom:15}} />
        <h2 style={{color:'#fff',letterSpacing:2}}>ĐỊNH MỆNH</h2>
        <p style={{color:'#666',fontSize:12}}>Thắp sáng linh hồn bằng API Key</p>
        <Input.Password placeholder="Chìa khóa..." value={k} onChange={e=>setK(e.target.value)} style={{borderRadius:10,marginBottom:20,background:'#1a1a1a',color:'#fff',border:'1px solid #333'}} />
        <Button type="primary" block onClick={onL} style={{borderRadius:10,background:'#6c5ce7',border:'none',height:40}}>THẮP SÁNG</Button>
      </Card>
    </div>
  );

  return (
    <div style={{display:'flex',height:'100vh',background:'#000',padding:8,gap:8}}>
      <div style={{width:70,background:'#111',borderRadius:20,padding:'15px 0',display:'flex',flexDirection:'column',alignItems:'center',border:'1px solid #222'}}>
        <div style={{flex:1,overflowY:'auto',width:'100%',textAlign:'center'}}>
          <List dataSource={chars} renderItem={(i:any)=>(
            <Avatar src={i.avatar} size={45} onClick={()=>{setSel(i);setMsgs([{role:'model',content:i.firstMessage}]);}} 
            style={{cursor:'pointer',marginBottom:15,border:sel?.id===i.id?'2px solid #6c5ce7':'2px solid transparent'}} />
          )} />
        </div>
        <Button icon={<LogoutOutlined />} shape="circle" onClick={onOut} style={{background:'#333',color:'#ff4d4f',border:'none'}} />
      </div>
      <div style={{flex:1,background:'#fff',borderRadius:20,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'inset 0 0 10px rgba(0,0,0,0.1)'}}>
        {sel ? (
          <>
            <div style={{padding:'10px 20px',background:'#fff',borderBottom:'1px solid #eee',display:'flex',justifyContent: 'space-between',alignItems:'center'}}>
              <div><b style={{color:'#111'}}>{sel.name}</b><div style={{fontSize:10,color:'#6c5ce7'}}>Đang thắp sáng...</div></div>
              <Button type="text" icon={<EyeOutlined style={{color:'#999'}}/>} onClick={()=>setVP(true)} />
            </div>
            <div style={{flex:1,padding:15,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,background:'#fcfcfc'}}>
              {msgs.map((m,i)=>(
                <div key={i} style={{alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'85%'}}>
                  <div style={{padding:'10px 14px',borderRadius:18,background:m.role==='user'?'#2d1b4e':'#fff',color:m.role==='user'?'#fff':'#111',boxShadow:'0 2px 5px rgba(0,0,0,0.05)',border:m.role==='user'?'none':'1px solid #eee'}}>{m.content}</div>
                </div>
              ))}
              <div ref={endR} />
            </div>
            <div style={{padding:10,display:'flex',gap:8,background:'#fff',borderTop:'1px solid #eee'}}>
              <Input value={inpt} onChange={e=>setInpt(e.target.value)} onPressEnter={onS} placeholder="Gửi tâm tư..." style={{borderRadius:20,background:'#f5f5f5',border:'none'}} />
              <Button type="primary" shape="circle" icon={<SendOutlined />} onClick={onS} style={{background:'#2d1b4e',border:'none'}} />
            </div>
          </>
        ) : <div style={{margin:'auto',color:'#999',textAlign:'center'}}><FireOutlined style={{fontSize:30}}/><p>Chọn một linh hồn</p></div>}
      </div>
      <Modal open={vP} onCancel={()=>setVP(false)} footer={null} bodyStyle={{textAlign:'center',padding:30}}>
        <Avatar src={sel?.avatar} size={80} style={{border:'2px solid #6c5ce7',marginBottom:10}} />
        <h3>{sel?.name}</h3><p style={{color:'#666'}}>{sel?.background}</p>
      </Modal>
    </div>
  );
}
