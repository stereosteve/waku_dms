import { generatePrivateKey, getPublicKey, WakuMessage } from "js-waku";
import { ChatContentTopic } from "./App";
import ChatList from "./ChatList";
import MessageInput from "./MessageInput";
import { useWaku } from "./WakuContext";
import { TitleBar } from "@livechat/ui-kit";
import { Message } from "./Message";
import { useEffect, useState } from "react";
import { utils } from "js-waku";

interface Props {
  messages: Message[];
  nick: string;
}

export default function Room(props: Props) {
  const { waku } = useWaku();
  const [myPubkeyHex, setMyPubkeyHex] = useState<string | undefined>();
  const [storePeers, setStorePeers] = useState(0);
  const [relayPeers, setRelayPeers] = useState(0);

  useEffect(() => {
    if (!waku) return;

    // Update relay peer count on heartbeat
    waku.relay.on("gossipsub:heartbeat", () => {
      setRelayPeers(waku.relay.getPeers().size);
    });
  }, [waku]);

  useEffect(() => {
    if (!waku) return;

    const localStorageKey = "privatekey_hex";
    if (!localStorage.getItem(localStorageKey)) {
      const privateKey = generatePrivateKey();
      const pkHex = utils.bytesToHex(privateKey);
      console.log(`generated new privatekey: ${pkHex}`);
      localStorage.setItem(localStorageKey, pkHex);
    }

    const privateKey = utils.hexToBytes(localStorage.getItem(localStorageKey)!);
    const publicKey = getPublicKey(privateKey);
    setMyPubkeyHex(utils.bytesToHex(publicKey));
    console.log(`pubkey: ${utils.bytesToHex(publicKey)}`);

    waku.addDecryptionKey(privateKey);

    // Update store peer when new peer connected & identified
    waku.libp2p.peerStore.on("change:protocols", async () => {
      let counter = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _peer of waku.store.peers) {
        counter++;
      }
      setStorePeers(counter);
    });
  }, [waku]);

  async function handleMessage(
    payload: string,
    nick: string,
    messageSender: (msg: WakuMessage) => Promise<void>
  ) {
    const timestamp = new Date();
    const timestampNumber = Math.floor(timestamp.valueOf() / 1000);
    const message = new Message(
      {
        timestamp: timestampNumber,
        nick,
        fromPubkey: myPubkeyHex!,
        payload,
      },
      timestamp
    );

    // if toPubkeys exists... it's a DM
    // if it's a DM, send a message for each toPubkey
    // and also fromPubkey
    //  encPublicKey: pubkey
    const wakuMsg = await WakuMessage.fromUtf8String(
      message.encode(),
      ChatContentTopic,
      { timestamp }
    );
    return messageSender(wakuMsg);
  }

  return (
    <div
      className="chat-container"
      style={{ height: "98vh", display: "flex", flexDirection: "column" }}
    >
      <TitleBar
        leftIcons={[`Peers: ${relayPeers} relay ${storePeers} store.`]}
        title="Waku v2 chat app"
      />
      <ChatList messages={props.messages} />
      <div>TO WHOOOOM</div>
      <MessageInput
        sendMessage={
          waku
            ? async (messageToSend) => {
                return handleMessage(
                  messageToSend,
                  props.nick,
                  waku.relay.send.bind(waku.relay)
                );
              }
            : undefined
        }
      />
    </div>
  );
}
