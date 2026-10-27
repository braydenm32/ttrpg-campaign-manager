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

## What still says Supabase

Google's sign-in screen shows "to continue to ysrxumagiiaoihlhofqt.supabase.co", and Facebook shows
something similar. The only fix is a Supabase custom domain (e.g. `auth.wardedatlas.com`), a paid
add-on on the Pro plan (about US$35 a month together). Worth it only once the app is public.
