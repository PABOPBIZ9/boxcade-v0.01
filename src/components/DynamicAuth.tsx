"use client";

import { useMemo, useState } from "react";
import {
  useConnectAndVerifyWithWalletProvider,
  useGetAvailableWalletProvidersData,
  useGetWalletAccounts,
  useInitStatus,
  useLogout,
  useSendEmailOTP,
  useUser,
  useVerifyOTP,
} from "@dynamic-labs-sdk/react-hooks";
import type { WalletAccount } from "@dynamic-labs-sdk/client";
import { friendlyError } from "@/lib/payments";

export type DynamicUser = {
  email?: string | null;
  username?: string | null;
  alias?: string | null;
};

export function displayHandle(user: DynamicUser | null | undefined, accounts: WalletAccount[]) {
  const address = accounts[0]?.address;
  const name =
    user?.username ||
    user?.alias ||
    (user?.email ? user.email.split("@")[0] : "") ||
    (address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "player");
  return "@" + name;
}

export function useBoxcadeAuth() {
  const { data: initStatus } = useInitStatus();
  const { data: user } = useUser();
  const { data: accounts = [] } = useGetWalletAccounts();
  const { mutate: logout } = useLogout();
  const ready = initStatus === "finished";
  const handle = user ? displayHandle(user as DynamicUser, accounts) : null;
  return {
    ready,
    user: (user as DynamicUser | null | undefined) ?? null,
    handle,
    accounts,
    logout: () => logout(),
  };
}

function chainRank(chain: string | undefined) {
  const value = (chain || "").toLowerCase();
  if (value === "sol" || value === "solana" || value === "svm") return 0;
  if (value === "evm" || value === "eip155" || value === "ethereum") return 1;
  if (value === "btc" || value === "bitcoin") return 2;
  if (value === "ton") return 3;
  return 8;
}

export function DynamicSignIn({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const { ready, user, handle, accounts } = useBoxcadeAuth();
  const { data: providers = [] } = useGetAvailableWalletProvidersData();
  const { mutate: sendEmailOTP, data: otpVerification, isPending: sending, reset: resetOtp, error: sendError } =
    useSendEmailOTP();
  const { mutate: verifyOTP, isPending: verifying, error: verifyError } = useVerifyOTP();
  const { mutateAsync: connectWallet, isPending: connecting } = useConnectAndVerifyWithWalletProvider();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [walletError, setWalletError] = useState("");

  const sorted = useMemo(() => {
    return [...providers].sort((a, b) => {
      const rank = chainRank(String(a.chain)) - chainRank(String(b.chain));
      if (rank !== 0) return rank;
      return (a.metadata?.displayName || a.key).localeCompare(b.metadata?.displayName || b.key);
    });
  }, [providers]);

  const note = sendError ? friendlyError(sendError) : verifyError ? friendlyError(verifyError) : walletError;

  return (
    <>
      <h2>Sign in</h2>
      <p className="mut">Powered by Dynamic: wallets, email and social login in one.</p>
      {!ready ? (
        <p className="mut">Loading sign-in…</p>
      ) : user ? (
        <>
          <p>
            Signed in as <b>{handle}</b>
            {accounts[0]?.address ? (
              <span className="mut"> · {accounts[0].address.slice(0, 6)}…{accounts[0].address.slice(-4)}</span>
            ) : null}
          </p>
          <p className="mut">Wallets · Solana first</p>
        </>
      ) : !otpVerification ? (
        <>
          <input
            id="em"
            placeholder="you@email.com"
            style={{ width: "100%" }}
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p>
            <button
              className="btn"
              type="button"
              disabled={sending || !email.trim()}
              onClick={() => sendEmailOTP({ email: email.trim() })}
            >
              {sending ? "Sending…" : "Continue with email"}
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="mut">Enter the code sent to {email || "your email"}.</p>
          <input
            placeholder="123456"
            style={{ width: "100%" }}
            aria-label="Email code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p>
            <button
              className="btn"
              type="button"
              disabled={verifying || !code.trim()}
              onClick={() =>
                verifyOTP(
                  { otpVerification, verificationToken: code.trim() },
                  {
                    onSuccess: () => {
                      onToast("Signed in" + (handle ? " as " + handle : ""));
                      onClose();
                    },
                  },
                )
              }
            >
              {verifying ? "Verifying…" : "Verify code"}
            </button>{" "}
            <button className="btn w" type="button" onClick={() => { resetOtp(); setCode(""); }}>
              Back
            </button>
          </p>
        </>
      )}
      {ready ? (
        <>
          <div className="mut">Wallets · Solana first</div>
          <div className="chips">
            {sorted.length ? (
              sorted.map((provider) => (
                <button
                  key={provider.key}
                  className="chip wallet-chip"
                  type="button"
                  disabled={connecting}
                  onClick={async () => {
                    setWalletError("");
                    try {
                      await connectWallet({ walletProviderKey: provider.key });
                      onToast("Signed in with " + (provider.metadata?.displayName || provider.key));
                      onClose();
                    } catch (err) {
                      setWalletError(friendlyError(err));
                    }
                  }}
                >
                  {provider.metadata?.icon ? <img src={provider.metadata.icon} alt="" /> : null}
                  {provider.metadata?.displayName || provider.key}
                  {provider.chain ? ` · ${provider.chain}` : ""}
                </button>
              ))
            ) : (
              <span className="mut">Install a wallet (Phantom, Solflare, Backpack, MetaMask…) or continue with email.</span>
            )}
          </div>
        </>
      ) : null}
      {note ? <p className="mut">{note}</p> : null}
      <button className="btn w" type="button" onClick={onClose}>
        Close
      </button>
    </>
  );
}
