import { Waku, WakuMessage } from 'js-waku'
import { useState, useEffect } from 'react'

const TOPIC = 'replica_test_8'

const peers = [
  '/dns4/localhost/tcp/8005/ws/p2p/16Uiu2HAm4Z7BSydTt2WmNPdm3mu57Gr5emBNjqsBJnyNiifRtzWY',
  '/dns4/localhost/tcp/8006/ws/p2p/16Uiu2HAmSXY6voQFgDphNDQz3fFProHPFYCsC4tBvxh6BsfMVUG9',
  '/dns4/localhost/tcp/8007/ws/p2p/16Uiu2HAm7LQi8U6DhL4WvWBSFZhgn18xm8Vse6DtBhPhpMha1aGe',
  '/dns4/localhost/tcp/8008/ws/p2p/16Uiu2HAm5RQL6KdAvnuiTPfQgArnBqpaVxQepZeWaCzEDd8L8M5q',
  '/dns4/localhost/tcp/8009/ws/p2p/16Uiu2HAkzrgawL7rpns8uFNUhFKor4RyqCgMSKUTGWfZhdbDFLvq',
]

let counter = 0

export function ReplicationTest() {
  return (
    <div
      style={{ display: 'flex', background: '#efefef', padding: '40px 20px' }}
    >
      {peers.map((peer) => (
        <WakuDisplay key={peer} multi={peer} />
      ))}
    </div>
  )
}

function WakuDisplay({ multi }: { multi: string }) {
  const port = multi.split('/')[4]
  const waku = useWaku(multi)
  const [storePeers, setStorePeers] = useState(0)
  const [relayPeers, setRelayPeers] = useState(0)
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    if (!waku) return

    // Update relay peer count on heartbeat
    waku.relay.on('gossipsub:heartbeat', () => {
      setRelayPeers(waku.relay.getPeers().size)
    })

    loadHistory(waku).then((history) => {
      setLog(history)

      waku.relay.addObserver(
        function (wakuMsg) {
          setLog((old) => [...old, wakuMsg.payloadAsUtf8])
        },
        [TOPIC]
      )
    })
  }, [waku])

  useEffect(() => {
    if (!waku) return

    // Update store peer when new peer connected & identified
    waku.libp2p.peerStore.on('change:protocols', async () => {
      let counter = 0
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _peer of waku.store.peers) {
        counter++
      }
      setStorePeers(counter)
    })
  }, [waku])

  async function sendit() {
    const wakuMsg = await WakuMessage.fromUtf8String(
      `testing ${counter}`,
      TOPIC,
      { timestamp: new Date() }
    )
    counter++
    // console.log('sending message', { chan, encPublicKey })
    const result = await waku!.relay.send(wakuMsg)
    console.log(result)
  }

  return (
    <div className="waku-display">
      <h2>{port}</h2>
      <div>
        relayPeers: {relayPeers}
        <br />
        storePeers: {storePeers}
        <br />
        <br />
        <button onClick={sendit}>send</button>
        <br />
        <br />
      </div>

      {log.map((item, idx) => (
        <div key={idx}>{item}</div>
      ))}
    </div>
  )
}

// const wakuPromise = Waku.create({
//   libp2p: {
//     config: {
//       pubsub: {
//         enabled: true,
//         emitSelf: true,
//       },
//     },
//   },
//   bootstrap: {
//     peers: [
//       '/dns4/localhost/tcp/8005/ws/p2p/16Uiu2HAm4Z7BSydTt2WmNPdm3mu57Gr5emBNjqsBJnyNiifRtzWY',
//       '/dns4/localhost/tcp/8006/ws/p2p/16Uiu2HAmSXY6voQFgDphNDQz3fFProHPFYCsC4tBvxh6BsfMVUG9',
//       '/dns4/localhost/tcp/8007/ws/p2p/16Uiu2HAm7LQi8U6DhL4WvWBSFZhgn18xm8Vse6DtBhPhpMha1aGe',
//       '/dns4/localhost/tcp/8008/ws/p2p/16Uiu2HAm5RQL6KdAvnuiTPfQgArnBqpaVxQepZeWaCzEDd8L8M5q',
//       '/dns4/localhost/tcp/8009/ws/p2p/16Uiu2HAkzrgawL7rpns8uFNUhFKor4RyqCgMSKUTGWfZhdbDFLvq',
//     ],
//   },
// })

async function loadHistory(waku: Waku) {
  console.log('loading history...')
  await waku.waitForRemotePeer()
  const wakuMessages = await waku.store.queryHistory([TOPIC])
  wakuMessages.sort((a, b) => (a.timestamp! < b.timestamp! ? -1 : 1))
  const history = wakuMessages
    .map((wakuMsg) => wakuMsg.payloadAsUtf8)
    .filter(Boolean)

  return history
}

function useWaku(multi: string) {
  const [waku, setWaku] = useState<Waku | undefined>()

  useEffect(() => {
    if (waku) return

    Waku.create({
      libp2p: {
        config: {
          pubsub: {
            enabled: true,
            emitSelf: true,
          },
        },
      },
      bootstrap: {
        peers: [multi],
      },
    })
      .then(setWaku)
      .catch((e) => {
        console.log('Waku init failed ', e)
      })
  }, [waku])

  return waku
}
