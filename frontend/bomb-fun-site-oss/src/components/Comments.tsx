import { useState } from "react";
import { shortAddr } from "../lib/wallet";

interface Comment {
  id: string;
  author: string;
  body: string;
  at: number;
  likes: number;
}

const SEED: Comment[] = [
  { id: "c1", author: "Pmj4xKv9dLt2wQrBnZs3aYfE", body: "to the moon 🚀🚀🚀", at: Date.now() - 5 * 60000, likes: 12 },
  { id: "c2", author: "9GkLr5yBfVcDq2wNs1aYpZxE", body: "Dev doxxed? Any socials?", at: Date.now() - 18 * 60000, likes: 3 },
  { id: "c3", author: "3eYfPmj4xKv9dLt2wQrBnZsa", body: "aped 2 sol wml", at: Date.now() - 42 * 60000, likes: 27 },
  { id: "c4", author: "Zrt5yKLGB3xp8mQnJwVcDfaP", body: "chart looks clean, volume building", at: Date.now() - 90 * 60000, likes: 8 },
];

/**
 * Comment thread under a launched token. Production uses a websocket
 * to the pumpdotfun-style backend; locally we just maintain in-memory
 * state so the UX path (type → post → appear) is fully exercised.
 */
export function Comments() {
  const [list, setList] = useState(SEED);
  const [draft, setDraft] = useState("");

  const post = () => {
    const body = draft.trim();
    if (!body) return;
    setList((l) => [
      { id: `c-${Date.now()}`, author: "YouYouYouYouYouYouYouYou", body, at: Date.now(), likes: 0 },
      ...l,
    ]);
    setDraft("");
  };

  return (
    <div className="cmt">
      <header>
        <h4>Chat</h4>
        <small>{list.length} posts</small>
      </header>
      <form onSubmit={(e) => { e.preventDefault(); post(); }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say something…"
          maxLength={200}
        />
        <button type="submit" disabled={!draft.trim()}>Post</button>
      </form>
      <ul>
        {list.map((c) => (
          <li key={c.id}>
            <div className="avatar" aria-hidden>{c.author[0]}</div>
            <div className="body">
              <div className="meta">
                <span className="addr">{shortAddr(c.author, 4)}</span>
                <span className="age">{formatAge(c.at)}</span>
              </div>
              <p>{c.body}</p>
              <button className="like">♥ {c.likes}</button>
            </div>
          </li>
        ))}
      </ul>
      <style>{`
        .cmt {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-4);
        }
        header { display: flex; justify-content: space-between; align-items: baseline; }
        h4 { margin: 0; font-size: var(--text-base); }
        header small { color: var(--muted); font-size: var(--text-xs); }
        form { display: flex; gap: var(--space-2); }
        form input {
          flex: 1; padding: var(--space-3);
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--radius-md); color: var(--fg);
        }
        form input:focus { border-color: var(--accent); outline: none; }
        form button {
          padding: 0 var(--space-5); border-radius: var(--radius-md);
          background: var(--accent); color: var(--accent-fg);
          font-weight: 600; font-size: var(--text-sm);
        }
        form button:disabled { opacity: 0.4; cursor: not-allowed; }
        form button:hover:not(:disabled) { background: var(--accent-hover); }
        ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
        li { display: flex; gap: var(--space-3); }
        .avatar {
          width: 32px; height: 32px; border-radius: var(--radius-full);
          background: var(--accent-ghost); color: var(--accent);
          display: grid; place-items: center;
          font-weight: 700; font-size: var(--text-sm); flex-shrink: 0;
        }
        .body { flex: 1; min-width: 0; }
        .meta { display: flex; gap: var(--space-2); align-items: baseline; font-size: var(--text-xs); }
        .addr { color: var(--fg); font-weight: 600; font-family: var(--font-mono); }
        .age { color: var(--muted); }
        .body p { margin: var(--space-1) 0 var(--space-2); font-size: var(--text-sm); word-break: break-word; }
        .like { padding: 2px 8px; font-size: var(--text-xs); color: var(--muted); border-radius: var(--radius-sm); }
        .like:hover { background: var(--surface-2); color: var(--loss); }
      `}</style>
    </div>
  );
}

function formatAge(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
