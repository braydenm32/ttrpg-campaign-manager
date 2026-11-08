# Branded emails and Google / Facebook sign-in

The app side is done. These steps happen in your own accounts. Supabase project: **campaign-codex**
(`ysrxumagiiaoihlhofqt`). Two addresses come up a lot:

- **App address:** `https://wardedatlas.com/` (the old `https://braydenm32.github.io/ttrpg-campaign-manager/`
  still works: it offers to move worlds saved there, then forwards to the new address)
- **Callback address:** `https://ysrxumagiiaoihlhofqt.supabase.co/auth/v1/callback`

## 1. Emails that come from the Warded Atlas

### a. Paste the templates (free, 5 minutes)

Supabase dashboard → **Authentication → Emails → Templates**. For each one below, set the subject,
switch the body to source/HTML, and paste the whole file from `supabase/templates/`:

| Template | Subject | File |
| --- | --- | --- |
| Confirm signup | Confirm your Warded Atlas account | `confirm-signup.html` |
| Reset password | Reset your Warded Atlas password | `reset-password.html` |
| Change email address | Confirm your new Warded Atlas email | `change-email.html` |
| Magic link | Your Warded Atlas sign-in link | `magic-link.html` |

These templates link straight to the app address, so the supabase.co link is gone from the email.

### b. Send from your own name (custom SMTP)

Supabase's built-in mailer always signs as "Supabase Auth", only sends to your own team's addresses,
and allows about 2 emails an hour, so you need this before anyone else can sign up. Pick one:

- **Gmail (free, quickest).** Turn on 2-step verification on your Google account, then make an app
  password at <https://myaccount.google.com/apppasswords>. Emails arrive as "The Warded Atlas" but from
  your Gmail address. Fine for friends, about 500 a day.
- **Resend (free up to 3,000 a month, best for publishing; in use).** Sign up at <https://resend.com>,
  add wardedatlas.com and let it add its DNS records in Cloudflare. Then make an API key.

Then Supabase → **Authentication → Emails → SMTP Settings** → turn on custom SMTP:

| Field | Gmail | Resend |
| --- | --- | --- |
| Sender email | your Gmail address | `hello@wardedatlas.com` |
| Sender name | The Warded Atlas | The Warded Atlas |
| Host | `smtp.gmail.com` | `smtp.resend.com` |
| Port | `465` | `465` |
| Username | your Gmail address | `resend` |
| Password | the app password | the Resend API key |

Afterwards, raise the email rate limit under **Authentication → Rate Limits** (30 an hour is plenty).

## 2. The web address (Cloudflare Pages)

The web app is published twice from `main`: GitHub Pages (the old address, kept so worlds saved there
can be moved and old links keep working) and Cloudflare Pages at wardedatlas.com.

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, pick `ttrpg-campaign-manager`.
2. Production branch `main`. Build command `npm ci --ignore-scripts && npm run build`, output folder
   `dist`. Environment variables: `NODE_VERSION` = `22`, `SKIP_DEPENDENCY_INSTALL` = `1`.
3. Once it has built: **Custom domains → Set up a custom domain → wardedatlas.com** (remove it from
   any other Pages project first).
4. Supabase → **Authentication → URL Configuration**: Site URL `https://wardedatlas.com`, and add
   `https://wardedatlas.com/**` to Redirect URLs (keep the old address there too).

### Checking the security headers

Cloudflare sends a few security headers with every file of the site, from `public/_headers`. The main
one, the Content-Security-Policy, lists where the app may load code and pictures from and which
servers it may talk to. That way a mistake in how text is shown can't run someone else's code or send
your keys and worlds anywhere else. The desktop app has its own copy of the policy in
`src-tauri/tauri.conf.json`. Nothing needs setting up in the dashboard. To check that the live site
sends the headers, after a deploy run this in a terminal (on Windows, type `curl.exe` instead of `curl`):

```
curl -I https://wardedatlas.com
```

The answer should have lines starting `content-security-policy:`, `strict-transport-security:`,
`x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy:` and
`permissions-policy:`. If they're missing, check that the latest deploy finished (**Workers & Pages →
the project → Deployments**). If you ever added headers by hand under **Rules → Transform Rules**,
take those out so the two sets don't clash.

If a feature stops working after the app starts using a new outside service, the browser's console
(F12) says "violates the following Content Security Policy directive". The service's address then
needs adding to `public/_headers` and to `src-tauri/tauri.conf.json`. The browser tests
(`tests/csp.spec.ts`) check that the two still agree.

## 3. Google sign-in

1. Go to <https://console.cloud.google.com>, make a project called The Warded Atlas.
2. **APIs & Services → OAuth consent screen**: External, app name The Warded Atlas, your email as
   support and developer contact, add the app address as the home page. Upload the sigil logo if you
   like. Under branding, add the privacy policy and terms links (see section 4). Publish the app
   (otherwise only test users you list can sign in).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type Web application.
   - Authorised JavaScript origins: `https://wardedatlas.com`
   - Authorised redirect URIs: the callback address above.
4. Copy the Client ID and Client secret.
5. Supabase → **Authentication → Sign In / Providers → Google**: turn it on, paste both, save.

## 4. Facebook sign-in

1. Go to <https://developers.facebook.com/apps>, **Create app**, choose "Authenticate and request data
   from users with Facebook Login", name it The Warded Atlas.
2. **Facebook Login → Settings**: add the callback address under Valid OAuth Redirect URIs.
3. **App settings → Basic**: copy the App ID and App secret. Fill in:
   - Privacy policy URL: `https://wardedatlas.com/privacy.html`
   - Terms of service URL: `https://wardedatlas.com/terms.html`
   - User data deletion: "Data deletion instructions URL",
     `https://wardedatlas.com/data-deletion.html`
4. Under **Use cases → Permissions**, make sure `email` and `public_profile` are added.
5. Switch the app from Development to **Live** (top of the page).
6. Supabase → **Authentication → Sign In / Providers → Facebook**: turn it on, paste both, save.

The buttons appear in the app's sign-in box by themselves once a provider is switched on. They are
hidden in the desktop app, which keeps to email sign-in for now.

## 5. The Warded Atlas pack (Cloudflare R2)

The map pieces that come with the app (the "Warded Atlas pack" under "Your packs" in the map builder) are pictures in a Cloudflare R2 bucket, read by every copy of the app from `https://packs.wardedatlas.com` (`src/packs/builtin.ts`). Its wall and fence sets (the Walls tool) and floor textures (the Ground tool) are in the same bucket, listed under `extra` in `manifest.json` so that copies of the app from before them don't offer them as pieces. They're made with `scripts/build-pack.py` from the pack's index and put there with `scripts/upload-pack.py`, which only sends pictures that aren't there yet. Until the bucket has them, the pack simply doesn't show.

The pack's pictures (about 145 MB once converted) will be kept in a Cloudflare R2 bucket. Anyone using the app can read them, and downloads are free. You set up the bucket once. After that I upload the pictures, and the app reads them from `https://packs.wardedatlas.com`.

### 1. Make the bucket (Cloudflare dashboard)

1. Open **R2 Object Storage** and choose **Create bucket**.
2. Name it `warded-atlas-pack`. Leave the location on Automatic and the storage class on Standard.
3. In the bucket, open **Settings › Custom Domains › Connect Domain** and enter `packs.wardedatlas.com`. Cloudflare adds the DNS record itself because wardedatlas.com is already there.
4. Still in **Settings**, find **CORS Policy › Add CORS policy**, paste the following and save:

```json
[
  {
    "AllowedOrigins": ["https://wardedatlas.com", "https://www.wardedatlas.com", "https://braydenm32.github.io", "http://localhost:5173", "http://localhost:4175"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

### 2. Make a key for uploading

1. On the R2 overview page, open **Manage API tokens** (also called "API Tokens") and choose **Create API token**.
2. Set Permissions to **Object Read & Write** and apply it only to the `warded-atlas-pack` bucket.
3. Create it. Cloudflare shows an **Access Key ID** and a **Secret Access Key** once, so keep that page open for the next step.
4. Write down your **Account ID** too. It's shown on the right of the R2 overview page.

Never paste these keys into the chat.

### 3. Let a session reach Cloudflare (Claude project settings)

This project runs on a built-in cloud setup with no settings, so it needs one of its own:

1. Open **Project settings › Cloud environment**, open the menu and choose **Add cloud environment**.
2. Under **Network access**, add `*.r2.cloudflarestorage.com` to the allowed domains. Leave "Allow package managers" ticked.
3. Under **Environment variables**, add these three:
   - `R2_ACCOUNT_ID`: your Account ID
   - `R2_ACCESS_KEY_ID`: the Access Key ID
   - `R2_SECRET_ACCESS_KEY`: the Secret Access Key
4. Save it. Only sessions started after this can use it, so tell me in the chat when it's done and I'll do the upload in a fresh thread.

## 6. Password rules (Supabase)

Supabase → **Authentication → Sign In / Providers → Email** (the password settings under it), or
straight there: <https://supabase.com/dashboard/project/ysrxumagiiaoihlhofqt/auth/providers?provider=Email>.
Press **Save** at the bottom when done.

- **Minimum password length**: 10. Anything under 8 is easy to guess.
- **Password requirements**: letters and digits.
- **Prevent use of leaked passwords** turns away passwords that are in known leaks (it asks
  HaveIBeenPwned, without sending the password itself). Supabase only offers it on the Pro plan, so
  switch it on if the project ever moves to Pro.

The app asks for the same when someone signs up or picks a new password: "At least 10 characters,
with letters and numbers" sits under the password box, and it's checked before anything is sent
(`PASSWORD_RULE` in `src/cloud/client.ts`). If you change the numbers here, the app's wording has
to change with them, so say so in the chat.

People who already have a weaker password can still sign in; they're asked for a stronger one only
when they next pick a new password. Google sign-in isn't affected.

## What still says Supabase

Google's sign-in screen shows "to continue to ysrxumagiiaoihlhofqt.supabase.co", and Facebook shows
something similar. The only fix is a Supabase custom domain (e.g. `auth.wardedatlas.com`), a paid
add-on on the Pro plan (about US$35 a month together). Worth it only once the app is public.
