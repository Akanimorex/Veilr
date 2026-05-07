import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/web';

// Use multiple RPCs for redundancy and better reliability
const RPC_URLS = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.ankr.com/eth_sepolia',
    'https://sepolia.drpc.org'
];

async function fetchRPC(method: string, params: any[]) {
    for (const url of RPC_URLS) {
        try {
            console.log(`Worker: Trying RPC ${url} for ${method}`);
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000); // 5s timeout per RPC
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
                signal: controller.signal
            });
            clearTimeout(id);
            
            if (!response.ok) continue;
            const json = await response.json();
            if (json.result !== undefined) return json.result;
        } catch (e) {
            console.warn(`Worker: RPC ${url} failed:`, e);
        }
    }
    throw new Error("All Sepolia RPCs failed or timed out. Please check your internet connection.");
}

const mockProvider = {
    request: async ({ method, params }: { method: string, params?: any[] }) => {
        if (method === 'eth_chainId') return '0xaa36a7';
        return await fetchRPC(method, params || []);
    }
};

let instancePromise: ReturnType<typeof createInstance> | null = null;

const getSDKInstance = () => {
    if (!instancePromise) {
        console.log("Worker: Initializing SDK...");
        instancePromise = initSDK().then(() => {
            console.log("Worker: SDK Inited, creating instance...");
            return createInstance({ ...SepoliaConfig, network: mockProvider as any });
        }).then(inst => {
            console.log("Worker: Instance created successfully");
            return inst;
        });
    }
    return instancePromise;
};

// Start init immediately
getSDKInstance().catch(err => console.error("Worker: SDK Init Error:", err));

function toHex(value: unknown): string {
    if (value === null || value === undefined) throw new Error("Value is null/undefined");
    if (typeof value === 'string') return value.startsWith('0x') ? value : '0x' + value;
    if (value instanceof Uint8Array) return '0x' + Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('');
    if (ArrayBuffer.isView(value)) {
        const u8 = new Uint8Array((value as ArrayBufferView).buffer, (value as ArrayBufferView).byteOffset, (value as ArrayBufferView).byteLength);
        return '0x' + Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (value instanceof ArrayBuffer) return '0x' + Array.from(new Uint8Array(value)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (typeof value === 'bigint' || typeof value === 'number') return '0x' + BigInt(value as any).toString(16);
    throw new Error(`Cannot convert to hex: ${typeof value}`);
}

self.onmessage = async (e: MessageEvent) => {
    const { contractAddress, userAddress, values } = e.data;

    try {
        console.log("Worker: Request received", { contractAddress, userAddress });
        
        const instance = await getSDKInstance();
        console.log("Worker: Creating encrypted input...");
        
        const input = instance.createEncryptedInput(contractAddress, userAddress);

        for (const v of values) {
            if (v.type === 'address') input.addAddress(v.value);
            else if (v.type === 'uint64')  input.add64(v.value);
            else if (v.type === 'uint32')  input.add32(v.value);
            else if (v.type === 'uint16')  input.add16(v.value);
            else if (v.type === 'uint8')   input.add8(v.value);
        }

        console.log("Worker: Starting input.encrypt() - this is the heavy part...");
        const startTime = Date.now();
        const { handles, inputProof } = await input.encrypt();
        console.log(`Worker: Encryption finished in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

        const safeHandles = (handles as unknown[]).map(toHex);
        const safeInputProof = toHex(inputProof);

        self.postMessage({ success: true, handles: safeHandles, inputProof: safeInputProof });
    } catch (error: any) {
        console.error("Worker Execution Error:", error);
        self.postMessage({ success: false, error: error?.message ?? String(error) });
    }
};
