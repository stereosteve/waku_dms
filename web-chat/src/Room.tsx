import { generatePrivateKey, getPublicKey, WakuMessage } from "js-waku";
import { ChatContentTopic } from "./App";
import ChatList from "./ChatList";
import MessageInput from "./MessageInput";
import { useWaku } from "./WakuContext";
import { TitleBar } from "@livechat/ui-kit";
import { Message } from "./Message";
import { ChatMessage } from "./chat_message";
import { useEffect, useState } from "react";
import { utils } from "js-waku";

interface Props {
  messages: Message[];
  commandHandler: (cmd: string) => void;
  nick: string;
}

export default function Room(props: Props) {
  const { waku } = useWaku();

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
      <MessageInput
        sendMessage={
          waku
            ? async (messageToSend) => {
                return handleMessage(
                  messageToSend,
                  props.nick,
                  props.commandHandler,
                  waku.relay.send.bind(waku.relay)
                );
              }
            : undefined
        }
      />
    </div>
  );
}

async function handleMessage(
  message: string,
  nick: string,
  commandHandler: (cmd: string) => void,
  messageSender: (msg: WakuMessage) => Promise<void>
) {
  if (message.startsWith("/dm ")) {
    const args = message.split(" ");
    args.shift();
    if (args.length < 2) {
      console.error(`/dm {pubkey} {message}`);
      return;
    }

    const pubkeyHex = args.shift()!;
    console.log({ pubkeyHex });
    const pubkey = utils.hexToBytes(pubkeyHex);
    console.log({ pubkeyHex, pubkey });
    const txt = args.join(" ");
    console.log({ dm: true, pubkey, txt });

    const timestamp = new Date();
    const chatMessage = ChatMessage.fromUtf8String(timestamp, nick, txt);
    const wakuMsg = await WakuMessage.fromBytes(
      chatMessage.encode(),
      ChatContentTopic,
      { timestamp, encPublicKey: pubkey }
    );

    return messageSender(wakuMsg);

    // const chatMessage = ChatMessage.fromUtf8String(timestamp, nick, message);
    // const message = await WakuMessage.fromBytes(chatMessage.encode(),, ChatContentTopic, {
    //   encPublicKey: publicKey,
    // });
  }

  if (message.startsWith("/")) {
    commandHandler(message);
  } else {
    const timestamp = new Date();
    const chatMessage = ChatMessage.fromUtf8String(timestamp, nick, message);
    const wakuMsg = await WakuMessage.fromBytes(
      chatMessage.encode(),
      ChatContentTopic,
      { timestamp }
    );
    return messageSender(wakuMsg);
  }
}
