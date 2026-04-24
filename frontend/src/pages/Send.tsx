import { SendForm } from '../components/SendForm';

export const Send = () => {
    return (
        <div className="max-w-xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-semibold text-white tracking-tight mb-3">Send Internationally</h1>
                <p className="text-text-muted">Transfer funds with zero on-chain visibility of recipients or amounts.</p>
            </div>
            <SendForm />
        </div>
    );
};
