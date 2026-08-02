import WebSocket from 'ws';

const ws = new WebSocket('wss://chat.kirka.io');

ws.on('open', () => {
  console.log('Connected to wss://chat.kirka.io. Listening for 60 seconds...');
});

ws.on('message', (rawData) => {
  try {
    const data = JSON.parse(rawData.toString());
    if (data.type === 2) {
      console.log(`[Lobby Chat] ${data.user.name} (#${data.user.shortId}): ${data.message}`);
    } else {
      console.log(`[Other Type: ${data.type}]`, JSON.stringify(data));
    }
  } catch (err) {
    console.error('Parse error:', err.message);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err.message);
});

ws.on('close', () => {
  console.log('WebSocket closed.');
});

setTimeout(() => {
  console.log('Finished 60s test. Closing socket...');
  ws.close();
  process.exit(0);
}, 60000);
