export NODEKEY=58ba669daca707a4f21e64d28e3d6bc7f61f080a389f8e6c5080bac31e63d8b3

docker run -d --rm -p 8545:8545 -p 30303:30303 -p 60000:60000 -p 8000:8000 statusteam/nim-waku:latest \
  --nodekey=$NODEKEY \
  --storenode=/dns4/isaac-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmSvJ5sdNSXJkDo5NkTkH9DFoeHRTai3HLYaDpRncFM6h5 \
  --storenode=/dns4/hareesh-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmCyh1NtKeWyKapKxQ5jB7syr6myh7D2KtG7HNuRxbUs4v \
  --storenode=/dns4/joe-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmBFzip5j4TvECok3oFZ1dvJyDbWgUXSd1fHSS89iVTZbW \
  --staticnode=/dns4/isaac-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmSvJ5sdNSXJkDo5NkTkH9DFoeHRTai3HLYaDpRncFM6h5 \
  --staticnode=/dns4/hareesh-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmCyh1NtKeWyKapKxQ5jB7syr6myh7D2KtG7HNuRxbUs4v \
  --staticnode=/dns4/joe-waku.audius.co/tcp/8000/ws/p2p/16Uiu2HAmBFzip5j4TvECok3oFZ1dvJyDbWgUXSd1fHSS89iVTZbW \
  --persist-messages \
  --persist-peers \
  --websocket-support=true \
  --db-path=./data