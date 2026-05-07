import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/web';

// A real Sepolia RPC so the worker can fetch the public key from the contract
const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

const mockProvider = {
    request: async ({ method, params }: { method: string, params?: any[] }) => {
        if (method === 'eth_chainId') return '0xaa36a7'; // 11155111
        
        // Forward calls to a real RPC if needed (like eth_call for public key)
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] })
        });
        const json = await response.json();
        return json.result;
    }
};

let instancePromise: ReturnType<typeof createInstance> | null = null;

const getSDKInstance = () => {
    if (!instancePromise) {
        instancePromise = initSDK().then(() =>
            createInstance({ ...SepoliaConfig, network: mockProvider as any })
        );
    }
    return instancePromise;
};

getSDKInstance().catch(err => console.error("Worker SDK Init Error:", err));

function toHex(value: unknown): string {
    if (value === null || value === undefined) {
        throw new Error("Value is null or undefined");
    }
    if (typeof value === 'string') {
        return value.startsWith('0x') ? value : '0x' + value;
    }
    if (value instanceof Uint8Array) {
        return '0x' + Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (ArrayBuffer.isView(value)) {
        const u8 = new Uint8Array((value as ArrayBufferView).buffer,
                                  (value as ArrayBufferView).byteOffset,
                                  (value as ArrayBufferView).byteLength);
        return '0x' + Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (value instanceof ArrayBuffer) {
        return '0x' + Array.from(new Uint8Array(value)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (typeof value === 'bigint' || typeof value === 'number') {
        return '0x' + BigInt(value as any).toString(16);
    }
    throw new Error(`Cannot convert to hex: ${typeof value} — ${String(value)}`);
}

self.onmessage = async (e: MessageEvent) => {
    const { contractAddress, userAddress, values } = e.data;

    try {
        console.log("Worker: Starting encryption for", contractAddress);
        const instance = await getSDKInstance();
        const input = instance.createEncryptedInput(contractAddress, userAddress);

        for (const v of values) {
            if (v.type === 'address') input.addAddress(v.value);
            else if (v.type === 'uint64')  input.add64(v.value);
            else if (v.type === 'uint32')  input.add32(v.value);
            else if (v.type === 'uint16')  input.add16(v.value);
            else if (v.type === 'uint8')   input.add8(v.value);
        }

        const { handles, inputProof } = await input.encrypt();
        console.log("Worker: Encryption successful");

        const safeHandles = (handles as unknown[]).map(toHex);
        const safeInputProof = toHex(inputProof);

        console.log("Worker: Sending back results", { safeHandles, proofLength: safeInputProof.length });
        self.postMessage({ success: true, handles: safeHandles, inputProof: safeInputProof });
    } catch (error: any) {
        console.error("Worker Error:", error);
        self.postMessage({ success: false, error: error?.message ?? String(error) });
    }
};
