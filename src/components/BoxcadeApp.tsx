"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { WalletAccount } from "@dynamic-labs-sdk/client";
import { acts, boxes, CH, f, offers, sol, usd, type Box } from "@/lib/catalog";
import { getPublicConfig, type PublicConfig } from "@/lib/config";
import { hasDynamicEnv } from "@/lib/env";
import { useDynamicReady } from "./DynamicReady";
import { friendlyError, payCrypto } from "@/lib/payments";
import { DynamicSignIn, useBoxcadeAuth } from "./DynamicAuth";

const config: PublicConfig = getPublicConfig();

const DEMO_WALLETS = ["Phantom", "Solflare", "Backpack", "MetaMask", "Zcash wallet"];

function sv(b: Box, w?: number) {
  return `<svg viewBox="0 0 120 120" ${w ? `width="${w}"` : ""}><polygon points="60,10 108,32 60,54 12,32" fill="#fff7e8" stroke="#1b1030" stroke-width="4" stroke-linejoin="round"/><polygon points="12,32 60,54 60,108 12,86" fill="${b.s[1]}" stroke="#1b1030" stroke-width="4" stroke-linejoin="round"/><polygon points="60,54 108,32 108,86 60,108" fill="${b.s[2]}" stroke="#1b1030" stroke-width="4" stroke-linejoin="round"/><path d="M36,43 L84,21 M60,54 V108" stroke="${b.s[3]}" stroke-width="7"/><text x="22" y="92" font-size="36" font-weight="900" fill="${b.s[3]}" stroke="#1b1030" stroke-width="2" transform="skewY(24) translate(0,-20)">?</text><circle cx="86" cy="68" r="9" fill="${b.s[3]}" stroke="#1b1030" stroke-width="3"/></svg>`;
}

const pip = `<svg viewBox="0 0 140 150" width="130"><rect x="38" y="4" width="64" height="44" rx="6" fill="#6c4bff" stroke="#1b1030" stroke-width="4"/><rect x="26" y="42" width="88" height="12" rx="6" fill="#ff3d5a" stroke="#1b1030" stroke-width="4"/><circle cx="70" cy="98" r="48" fill="#ffc93c" stroke="#1b1030" stroke-width="4"/><circle cx="26" cy="70" r="14" fill="#ffc93c" stroke="#1b1030" stroke-width="4"/><circle cx="114" cy="70" r="14" fill="#ffc93c" stroke="#1b1030" stroke-width="4"/><circle cx="52" cy="92" r="8" fill="#1b1030"/><circle cx="88" cy="92" r="8" fill="#1b1030"/><circle cx="55" cy="89" r="3" fill="#fff"/><circle cx="91" cy="89" r="3" fill="#fff"/><path d="M52,112 Q70,132 88,112 Z" fill="#ff3d5a" stroke="#1b1030" stroke-width="4"/><circle cx="40" cy="108" r="6" fill="#ff7ab6"/><circle cx="100" cy="108" r="6" fill="#ff7ab6"/></svg>`;

const bulbs = (
  <div className="bulbs">
    {Array.from({ length: 18 }, (_, i) => (
      <i key={i} />
    ))}
  </div>
);

type ModalKind = "signin" | "checkout" | "offer" | "signin-first" | "account" | null;

type ShellProps = {
  dynamicEnabled: boolean;
  authReady: boolean;
  signedHandle: string | null;
  accounts: WalletAccount[];
  logout: () => void;
};

function parseHash() {
  let h = (typeof window !== "undefined" ? window.location.hash.slice(1) : "") || "market";
  if (h === "offers" || h === "activity") h = "market-" + h;
  const [view, ...rest] = h.split("-");
  return { hash: h, view, sub: rest.join("-") };
}

function BoxcadeShell({ dynamicEnabled, authReady, signedHandle, accounts, logout }: ShellProps) {
  const [{ view, sub }, setRoute] = useState(parseHash);
  const [cart, setCart] = useState<Set<number>>(() => new Set());
  const [demoUser, setDemoUser] = useState<string | null>(null);
  const [pay, setPay] = useState<"crypto" | "card">("crypto");
  const [chain, setChain] = useState("Solana");
  const [tok, setTok] = useState("USDC");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [modal, setModal] = useState<ModalKind>(null);
  const [offerId, setOfferId] = useState<number | null>(null);
  const [offerTick, setOfferTick] = useState(0);
  const [toastText, setToastText] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const [spinDeg, setSpinDeg] = useState(0);
  const [spinResult, setSpinResult] = useState("Spin it. Practice wins nothing.");
  const [emailDraft, setEmailDraft] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [paying, setPaying] = useState(false);

  const user = dynamicEnabled ? signedHandle : demoUser;

  useEffect(() => {
    const onHash = () => {
      const next = parseHash();
      setRoute(next);
      if (next.view !== "market") window.scrollTo(0, 0);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const toast = useCallback((t: string) => {
    setToastText(t);
    setToastOn(true);
    window.setTimeout(() => setToastOn(false), 2600);
  }, []);

  const total = useMemo(
    () => [...cart].reduce((sum, id) => sum + (boxes.find((b) => b.id === id)?.p ?? 0), 0),
    [cart],
  );

  const setN = useCallback(
    (n: number) => {
      const list = [...boxes].sort((a, b) => a.p - b.p);
      setCart(new Set(list.slice(0, Math.max(0, n)).map((b) => b.id)));
    },
    [],
  );

  const toggleCart = (id: number) => {
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCheckout = (preset?: Set<number>) => {
    if (preset) setCart(preset);
    else if (!cart.size) setN(1);
    setModal("checkout");
  };

  const checkoutNote = dynamicEnabled
    ? "Card payments are a Whop stub until a plan is connected."
    : "Demo: payment buttons are stubs until Dynamic and Whop keys are connected.";

  async function runPay() {
    if (!user) {
      setModal("signin-first");
      return;
    }
    setPaying(true);
    try {
      const result = await payCrypto({
        chain,
        token: tok,
        solAmount: total || boxes[0].p,
        signedIn: !!user,
        dynamicEnabled,
        accounts,
        config,
      });
      if (result.kind === "need-sign-in") {
        setModal("signin-first");
        return;
      }
      if (result.kind === "need-wallet") {
        toast(result.message);
        setModal("signin");
        return;
      }
      setModal(null);
      toast(result.message);
    } catch (err) {
      toast(friendlyError(err));
    } finally {
      setPaying(false);
    }
  }

  function onClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
    if (!el) {
      if ((e.target as HTMLElement).id === "modal") setModal(null);
      return;
    }
    const a = el.dataset.a;
    const id = el.dataset.id ? +el.dataset.id : 0;
    const v = el.dataset.v;
    if (a === "open" || a === "tog") e.stopPropagation();
    if (a === "open") window.location.hash = "box-" + id;
    else if (a === "tog") toggleCart(id);
    else if (a === "inc") setN(cart.size + 1);
    else if (a === "dec") setN(Math.max(0, cart.size - 1));
    else if (a === "floor") setN(5);
    else if (a === "theme") {
      const r = document.documentElement;
      const dark = getComputedStyle(r).getPropertyValue("--bg").trim() === "#2a2468";
      r.dataset.theme = dark ? "light" : "dark";
    } else if (a === "signin") setModal("signin");
    else if (a === "account") setModal("account");
    else if (a === "logout") {
      if (dynamicEnabled) logout();
      setDemoUser(null);
      setModal(null);
      toast("Signed out");
    } else if (a === "login") {
      const name = "@" + (v === "email" ? emailDraft.split("@")[0] || "guest" : (v || "guest").toLowerCase() + "fan");
      setDemoUser(name);
      setModal(null);
      toast("Signed in as " + name);
    } else if (a === "close") setModal(null);
    else if (a === "buy") openCheckout(new Set([id]));
    else if (a === "checkout") openCheckout();
    else if (a === "pay") setPay(v as "crypto" | "card");
    else if (a === "chain" && v) {
      setChain(v);
      setTok(CH[v][0]);
    } else if (a === "tok" && v) setTok(v);
    else if (a === "pay-go") void runPay();
    else if (a === "card-go") {
      setModal(null);
      toast("Demo: opens Whop checkout");
    } else if (a === "offer") {
      setOfferId(id || null);
      setOfferPrice("");
      setModal("offer");
    } else if (a === "offer-go") {
      const x = +offerPrice;
      if (!x) {
        toast("Enter a price per box");
        return;
      }
      if (x > offers[0][0]) offers.unshift([x, user || "@you", "1d"]);
      setOfferTick((n) => n + 1);
      setModal(null);
      toast("Offer placed at " + sol(x));
    } else if (a === "spin") {
      const d = 360 * 5 + Math.floor(Math.random() * 360);
      setSpinDeg((prev) => prev + d);
      const P = ["Sticker pack", "Free spin", "Mystery crate!", "10 tickets", "Try again", "Mascot plush"];
      window.setTimeout(() => {
        setSpinResult("Practice result: " + P[Math.floor(((360 - (d % 360)) % 360) / 60)]);
      }, 3500);
    }
  }

  const listed = useMemo(() => {
    void offerTick;
    return [...boxes].sort((a, b) => (sort === "asc" ? a.p - b.p : b.p - a.p));
  }, [sort, offerTick]);

  const n = cart.size;

  let main: ReactNode = null;
  if (view === "box") main = renderDetail(+sub, cart);
  else if (view === "mine") main = renderMine(user);
  else if (view === "drop") main = renderDrop(spinDeg, spinResult);
  else main = renderMarket(sub || "items", listed, cart, sort, setSort);

  return (
    <div onClick={onClick}>
      <nav>
        <a className="logo" href="#market" aria-label="Boxcade home">
          <svg width="34" height="34" viewBox="0 0 120 120">
            <use href="#bx" />
          </svg>
          Boxcade
        </a>
        <a className={`tab${view === "market" ? " on" : ""}`} data-t="market" href="#market">
          Market
        </a>
        <a className={`tab${view === "drop" ? " on" : ""}`} data-t="drop" href="#drop">
          Midway
        </a>
        <a className={`tab${view === "mine" ? " on" : ""}`} data-t="mine" href="#mine">
          My boxes
        </a>
        <span className="sp" />
        <button className="btn w" data-a="theme" aria-label="Toggle theme">
          ◐
        </button>
        <button className="btn" id="si" data-a={user ? "account" : "signin"}>
          {user || "Sign in"}
        </button>
      </nav>
      <main id="app">{main}</main>
      <div className="sweep" id="sweep">
        <div className="q">
          <button data-a="dec" aria-label="Fewer">
            −
          </button>
          <b>{n}</b>
          <button data-a="inc" aria-label="More">
            +
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={boxes.length}
          value={n}
          id="rg"
          aria-label="Sweep count"
          style={{ width: 110, flex: 1 }}
          onChange={(e) => setN(+e.target.value)}
        />
        <span className="mut">
          Cart {n} · <b>{f(total)} SOL</b>
        </span>
        <button className="btn w" data-a="offer">
          Collection offer
        </button>
        <button className="btn" data-a="checkout">
          {n ? `Buy ${n} box${n > 1 ? "es" : ""}` : "Buy floor"}
        </button>
      </div>
      <div id="toast" role="status" style={{ display: toastOn ? "block" : "none" }}>
        {toastText}
      </div>
      <div className={`modal${modal ? " on" : ""}`} id="modal">
        <div className="panel" id="mp">
          {modal === "signin" &&
            (dynamicEnabled ? (
              <DynamicSignIn onClose={() => setModal(null)} onToast={toast} />
            ) : (
              <DemoSignIn email={emailDraft} onEmail={setEmailDraft} authReady={authReady} />
            ))}
          {modal === "signin-first" && (
            <>
              <h2>Sign in first</h2>
              <button className="btn" data-a="signin">
                Sign in
              </button>
            </>
          )}
          {modal === "account" && user && (
            <>
              <h2>{user}</h2>
              {accounts[0]?.address ? <p className="mut">{accounts[0].address}</p> : null}
              <p>
                <button className="btn" data-a="logout">
                  Log out
                </button>{" "}
                <button className="btn w" data-a="close">
                  Close
                </button>
              </p>
            </>
          )}
          {modal === "checkout" && (
            <>
              <h2>Checkout</h2>
              <p className="mut">
                {cart.size} box{cart.size > 1 ? "es" : ""} · {f(total)} SOL ≈ {usd(total)}
              </p>
              <div className="chips">
                <button className={`chip${pay === "crypto" ? " on" : ""}`} data-a="pay" data-v="crypto">
                  Crypto
                </button>
                <button className={`chip${pay === "card" ? " on" : ""}`} data-a="pay" data-v="card">
                  Card
                </button>
              </div>
              {pay === "crypto" ? (
                <>
                  <div className="mut">Network</div>
                  <div className="chips">
                    {Object.keys(CH).map((c) => (
                      <button key={c} className={`chip${c === chain ? " on" : ""}`} data-a="chain" data-v={c}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="mut">Pay with</div>
                  <div className="chips">
                    {CH[chain].map((c) => (
                      <button key={c} className={`chip${c === tok ? " on" : ""}`} data-a="tok" data-v={c}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <button className="btn r" style={{ width: "100%" }} data-a="pay-go" disabled={paying}>
                    {paying ? "Paying…" : user ? `Pay with ${tok} on ${chain}` : "Sign in to pay"}
                  </button>
                </>
              ) : (
                <>
                  <p>Cards are handled by Whop checkout, no wallet needed.</p>
                  <button className="btn r" style={{ width: "100%" }} data-a="card-go">
                    Pay {usd(total)} by card
                  </button>
                </>
              )}
              <p className="mut">{checkoutNote}</p>
              <button className="btn w" data-a="close">
                Close
              </button>
            </>
          )}
          {modal === "offer" && (
            <>
              <h2>{offerId ? "Make offer" : "Collection offer"}</h2>
              <p className="mut">Offers are held in WETH/USDC-style escrow and can be cancelled any time.</p>
              <input
                id="of"
                type="number"
                step="0.01"
                placeholder="Price per box (SOL)"
                style={{ width: "100%" }}
                aria-label="Offer price"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
              />
              <p>
                <select id="ex" aria-label="Expiry">
                  <option>Expires in 1 day</option>
                  <option>3 days</option>
                  <option>7 days</option>
                </select>
              </p>
              <button className="btn r" data-a="offer-go">
                Place offer
              </button>{" "}
              <button className="btn w" data-a="close">
                Close
              </button>
            </>
          )}
        </div>
      </div>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <g id="bx">
            <polygon points="60,10 108,32 60,54 12,32" fill="#fff7e8" stroke="#1b1030" strokeWidth="4" strokeLinejoin="round" />
            <polygon points="12,32 60,54 60,108 12,86" fill="#ff3d5a" stroke="#1b1030" strokeWidth="4" strokeLinejoin="round" />
            <polygon points="60,54 108,32 108,86 60,108" fill="#c41e45" stroke="#1b1030" strokeWidth="4" strokeLinejoin="round" />
            <text x="28" y="86" fontSize="38" fontWeight={900} fill="#ffc93c" stroke="#1b1030" strokeWidth="2" transform="skewY(24) translate(0,-20)">
              ?
            </text>
          </g>
        </defs>
      </svg>
    </div>
  );
}

function DemoSignIn({
  email,
  onEmail,
  authReady,
}: {
  email: string;
  onEmail: (v: string) => void;
  authReady: boolean;
}) {
  void authReady;
  return (
    <>
      <h2>Sign in</h2>
      <p className="mut">Powered by Dynamic: wallets, email and social login in one.</p>
      <p className="mut">Dynamic environment ID is not set yet — this is a demo sign-in.</p>
      <input
        id="em"
        placeholder="you@email.com"
        style={{ width: "100%" }}
        aria-label="Email"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
      />
      <p>
        <button className="btn" data-a="login" data-v="email">
          Continue with email
        </button>
      </p>
      <div className="mut">Wallets · Solana first</div>
      <div className="chips">
        {DEMO_WALLETS.map((w) => (
          <button key={w} className="chip" data-a="login" data-v={w}>
            {w}
          </button>
        ))}
      </div>
      <button className="btn w" data-a="close">
        Close
      </button>
    </>
  );
}

function Card({ b, selected }: { b: Box; selected: boolean }) {
  return (
    <div className={`card${selected ? " sel" : ""}`} data-a="open" data-id={b.id}>
      <span className="tag">#{b.n}</span>
      <button className="pm" data-a="tog" data-id={b.id} aria-label={selected ? "Remove from cart" : "Add to cart"}>
        {selected ? "−" : "+"}
      </button>
      <div className="img" dangerouslySetInnerHTML={{ __html: sv(b) }} />
      <div className="meta">
        <div className="mut">{b.s[0]}</div>
        <div className="price">{sol(b.p)}</div>
        <div className="mut">{usd(b.p)}</div>
      </div>
    </div>
  );
}

function renderMarket(sub: string, listed: Box[], cart: Set<number>, sort: "asc" | "desc", setSort: (v: "asc" | "desc") => void) {
  const tabs: [string, string][] = [
    ["items", "Items " + boxes.length],
    ["offers", "Offers " + offers.length],
    ["activity", "Activity"],
    ["about", "About"],
  ];
  let body: ReactNode;
  if (sub === "offers") body = renderOffers();
  else if (sub === "activity") body = renderActivity();
  else if (sub === "about") body = renderAbout();
  else {
    body = (
      <>
        <div className="bar">
          <span className="mut">{boxes.length} listed</span>
          <span className="sp" />
          <select id="sort" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as "asc" | "desc")}>
            <option value="asc">Price low to high</option>
            <option value="desc">Price high to low</option>
          </select>
        </div>
        <div className="grid">
          {listed.map((b) => (
            <Card key={b.id} b={b} selected={cart.has(b.id)} />
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <section className="hero">
        {bulbs}
        <div className="in">
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1>
              Mystery boxes.
              <br />
              <span>Real prizes.</span>
            </h1>
            <p style={{ maxWidth: 430 }}>
              Digital pals and physical collectibles sealed inside every crate. Trade them sealed, or crack them open at
              showtime.
            </p>
            <button className="btn r" data-a="floor">
              Sweep the floor
            </button>{" "}
            <a className="btn w" style={{ textDecoration: "none", display: "inline-block" }} href="#drop">
              Visit the midway
            </a>
          </div>
          <span dangerouslySetInnerHTML={{ __html: pip }} />
        </div>
      </section>
      <div className="stats">
        <div className="stat">
          <small>Floor</small>
          <b>{sol(boxes[0].p)}</b>
        </div>
        <div className="stat">
          <small>Top offer</small>
          <b>{sol(offers[0][0])}</b>
        </div>
        <div className="stat">
          <small>Listed</small>
          <b>{boxes.length}</b>
        </div>
        <div className="stat">
          <small>Owners</small>
          <b>612</b>
        </div>
        <div className="stat">
          <small>24h volume</small>
          <b>$9,260</b>
        </div>
      </div>
      <div className="chips" role="tablist" style={{ margin: "18px 0 10px" }}>
        {tabs.map((t) => (
          <a
            key={t[0]}
            className={`chip${sub === t[0] ? " on" : ""}`}
            role="tab"
            style={{ textDecoration: "none", fontSize: 15 }}
            href={`#market${t[0] === "items" ? "" : "-" + t[0]}`}
          >
            {t[1]}
          </a>
        ))}
      </div>
      {body}
    </>
  );
}

function renderOffers() {
  return (
    <>
      <div className="bar">
        <h2>Collection offers</h2>
        <span className="sp" />
        <button className="btn" data-a="offer">
          Make collection offer
        </button>
      </div>
      <div className="panel tw">
        <table>
          <thead>
            <tr>
              <th>Offer</th>
              <th>From</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o, i) => (
              <tr key={o[1] + o[0] + i}>
                <td>
                  <b>{sol(o[0])}</b> {i ? "" : "🏆"}
                </td>
                <td>{o[1]}</td>
                <td>{o[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderActivity() {
  return (
    <>
      <h2>Activity</h2>
      <div className="panel tw">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Box</th>
              <th>Price</th>
              <th>From</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {acts.map((a, i) => (
              <tr key={i}>
                <td>{a[0]}</td>
                <td>#{a[1].n}</td>
                <td>{sol(a[2])}</td>
                <td>@{a[3]}</td>
                <td className="mut">{a[4]}m ago</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderAbout() {
  const rows: [string, string][] = [
    ["Supply", "2,000"],
    ["Fee, incl. royalties", "5%"],
    ["Accepted", "SOL, USDC, USDT, ETH, BTC, ZEC, card"],
    ["Chain", "Solana first"],
  ];
  return (
    <div className="two">
      <div className="panel">
        <span dangerouslySetInnerHTML={{ __html: pip }} />
        <h2>Sealed until showtime</h2>
        <p>Every crate holds a surprise: a digital pal, sometimes a physical collectible shipped to your door. Trade sealed or hold to open.</p>
      </div>
      <div className="panel tw">
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                <td className="mut">{r[0]}</td>
                <td style={{ textAlign: "right" }}>
                  <b>{r[1]}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderDetail(id: number, cart: Set<number>) {
  const b = boxes.find((x) => x.id === id) || boxes[0];
  const rows: [string, string][] = [
    ["Box number", b.n],
    ["Series", b.s[0]],
    ["Contents", b.kind],
    ["Fee, incl. royalties", "5%"],
    ["Chain", "Solana"],
  ];
  return (
    <>
      <p>
        <a href="#market">← Market</a>
      </p>
      <div className="two">
        <div className="panel" style={{ background: "linear-gradient(#8fe3ff,#fff7e8)" }} dangerouslySetInnerHTML={{ __html: sv(b) }} />
        <div>
          <h1>
            {b.s[0]} <span style={{ background: "var(--yel)", color: "#1b1030", padding: "0 10px", borderRadius: 12 }}>#{b.n}</span>
          </h1>
          <p className="mut">
            Held by {b.by} · Sealed · {b.kind}
          </p>
          <div className="panel">
            <div className="mut">BUY FOR</div>
            <div className="d" style={{ fontSize: 38 }}>
              {sol(b.p)} <span className="mut" style={{ fontSize: 16 }}>≈ {usd(b.p)}</span>
            </div>
            <p>
              <button className="btn w" data-a="offer" data-id={b.id}>
                Make offer
              </button>{" "}
              <button className="btn" data-a="buy" data-id={b.id}>
                Buy now
              </button>{" "}
              <button className="btn w" data-a="tog" data-id={b.id}>
                {cart.has(b.id) ? "−" : "+"}
              </button>
            </p>
            <h3>Offers</h3>
            {offers.slice(0, 3).map((o) => (
              <div className="bar" key={o[1] + o[0]}>
                <b>{sol(o[0])}</b>
                <span className="mut">{o[1]}</span>
                <span className="sp" />
                <span className="mut">{o[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <h2 style={{ marginTop: 26 }}>Details</h2>
      <div className="panel tw">
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]}>
                <td className="mut">{r[0]}</td>
                <td style={{ textAlign: "right" }}>
                  <b>{r[1]}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ marginTop: 26 }}>Price history</h2>
      <div className="panel">
        <svg viewBox="0 0 300 90" width="100%" role="img" aria-label="Price history">
          <polyline fill="none" stroke="#ff3d5a" strokeWidth="4" points="0,20 60,34 120,52 180,50 240,60 300,58" />
        </svg>
      </div>
      <h2 style={{ marginTop: 26 }}>Activity</h2>
      <div className="panel tw">
        <table>
          <tbody>
            {acts.slice(0, 5).map((a, i) => (
              <tr key={i}>
                <td>{a[0]}</td>
                <td>{sol(a[2])}</td>
                <td>@{a[3]}</td>
                <td className="mut">{a[4]}m ago</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderMine(user: string | null) {
  if (user) {
    return (
      <>
        <h2>My boxes</h2>
        <div className="panel">No boxes yet in {user}. Win one at the midway or sweep the floor.</div>
      </>
    );
  }
  return (
    <div className="panel" style={{ textAlign: "center" }}>
      <span dangerouslySetInnerHTML={{ __html: pip }} />
      <h2>Sign in to see your boxes</h2>
      <p>
        <button className="btn" data-a="signin">
          Sign in
        </button>
      </p>
    </div>
  );
}

function renderDrop(spinDeg: number, spinResult: string) {
  return (
    <>
      <section className="hero">
        {bulbs}
        <div className="in">
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1>
              The <span>Midway</span> opens Nov 13.
            </h1>
            <p>Weighted raffle, prize wheel, capsule machine and claw. Unspent tickets always come back.</p>
          </div>
          <span dangerouslySetInnerHTML={{ __html: pip }} />
        </div>
      </section>
      <div className="two" style={{ marginTop: 18 }}>
        <div className="panel" style={{ textAlign: "center" }}>
          <h2>Free practice spin</h2>
          <div className="ptr" />
          <div className="wheel" id="wh" style={{ transform: `rotate(${spinDeg}deg)` }} />
          <p id="wr" className="mut">
            {spinResult}
          </p>
          <button className="btn r" data-a="spin">
            Spin
          </button>
        </div>
        <div className="panel">
          <h2>How the draw works</h2>
          <p>Your odds weigh tickets entered (70%), how early you join (15%) and what you&apos;ve held (15%).</p>
          <div className="chips">
            <span className="chip">Capsule machine</span>
            <span className="chip">Claw machine</span>
            <span className="chip">Sealed bids</span>
          </div>
          <p className="mut">Midway games are placeholders. Wire your own odds and payout rules server-side.</p>
        </div>
      </div>
    </>
  );
}

function LiveBoxcade() {
  const auth = useBoxcadeAuth();
  return (
    <BoxcadeShell
      dynamicEnabled
      authReady={auth.ready}
      signedHandle={auth.handle}
      accounts={auth.accounts}
      logout={auth.logout}
    />
  );
}

export function BoxcadeApp() {
  const dynamicReady = useDynamicReady();
  if (hasDynamicEnv && dynamicReady) return <LiveBoxcade />;
  return (
    <BoxcadeShell
      dynamicEnabled={hasDynamicEnv}
      authReady={!hasDynamicEnv}
      signedHandle={null}
      accounts={[]}
      logout={() => undefined}
    />
  );
}
