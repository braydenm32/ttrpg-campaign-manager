# Branded emails and Google / Facebook sign-in

The app side is done. These steps happen in your own accounts. Supabase project: **campaign-codex**
(`ysrxumagiiaoihlhofqt`). Two addresses come up a lot:

- **App address:** `https://braydenm32.github.io/ttrpg-campaign-manager/`
- **Callback address:** `https://ysrxumagiiaoihlhofqt.supabase.co/auth/v1/callback`

## 1. Emails that come from Campaign Codex

### a. Paste the templates (free, 5 minutes)

Supabase dashboard → **Authentication → Emails → Templates**. For each one below, set the subject,
switch the body to source/HTML, and paste the whole file from `supabase/templates/`:

| Template | Subject | File |
| --- | --- | --- |
| Confirm signup | Confirm your Campaign Codex account | `confirm-signup.html` |
| Reset password | Reset your Campaign Codex password | `reset-password.html` |
| Change email address | Confirm your new Campaign Codex email | `change-email.html` |
| Magic link | Your Campaign Codex sign-in link | `magic-link.html` |

These templates link straight to the app address, so the supabase.co link is gone from the email.

### b. Send from your own name (custom SMTP)

Supabase's built-in mailer always signs as "Supabase Auth", only sends to your own team's addresses,
and allows about 2 emails an hour, so you need this before anyone else can sign up. Pick one:

- **Gmail (free, quickest).** Turn on 2-step verification on your Google account, then make an app
  password at <https://myaccount.google.com/apppasswords>. Emails arrive as "Campaign Codex" but from
  your Gmail address. Fine for friends, about 500 a day.
- **Resend (free up to 3,000 a month, needs a domain, best for publishing).** Buy a domain (around
  A$20 a year, e.g. campaigncodex.app), sign up at <https://resend.com>, add the domain and copy the
  DNS records it shows into your domain registrar. Then make an API key.

Then Supabase → **Authentication → Emails → SMTP Settings** → turn on custom SMTP:

| Field | Gmail | Resend |
| --- | --- | --- |
| Sender email | your Gmail address | `hello@yourdomain` |
| Sender name | Campaign Codex | Campaign Codex |
| Host | `smtp.gmail.com` | `smtp.resend.com` |
| Port | `465` | `465` |
| Username | your Gmail address | `resend` |
| Password | the app password | the Resend API key |

Afterwards, raise the email rate limit under **Authentication → Rate Limits** (30 an hour is plenty).

## 2. Google sign-in

1. Go to <https://console.cloud.google.com>, make a project called Campaign Codex.
2. **APIs & Services → OAuth consent screen**: External, app name Campaign Codex, your email as
   support and developer contact, add the app address as the home page. Upload the sigil logo if you
   like. Publish the app (otherwise only test users you list can sign in).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**: type Web application.
   - Authorised JavaScript origins: `https://braydenm32.github.io`
   - Authorised redirect URIs: the callback address above.
4. Copy the Client ID and Client secret.
5. Supabase → **Authentication → Sign In / Providers → Google**: turn it on, paste both, save.

## 3. Facebook sign-in

1. Go to <https://developers.facebook.com/apps>, **Create app**, choose "Authenticate and request data
   from users with Facebook Login", name it Campaign Codex.
2. **Facebook Login → Settings**: add the callback address under Valid OAuth Redirect URIs.
3. **App settings → Basic**: copy the App ID and App secret. Facebook also wants a privacy policy
   URL and a data deletion instructions URL before the app can go Live.
4. Under **Use cases → Permissions**, make sure `email` and `public_profile` are added.
5. Switch the app from Development to **Live** (top of the page).
6. Supabase → **Authentication → Sign In / Providers → Facebook**: turn it on, paste both, save.

The buttons appear in the app's sign-in box by themselves once a provider is switched on. They are
hidden in the desktop app, which keeps to email sign-in for now.

## What still says Supabase

Google's sign-in screen shows "to continue to ysrxumagiiaoihlhofqt.supabase.co", and Facebook shows
something similar. The only fix is a Supabase custom domain (e.g. `auth.campaigncodex.app`), a paid
add-on on the Pro plan (about US$35 a month together). Worth it only once the app is public.
