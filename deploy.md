# Deploy VideoCompareMa on Ubuntu with nginx

VideoCompareMa is a static application. There is no build command, Node.js service, database, FFmpeg server, or upload endpoint. Only three files are served: `index.html`, `style.css`, and `app.js`. Selected videos are decoded locally in the visitor's browser and never sent to nginx.

The final address is `http://<serverIP>/VideoCompareMa/`. The configuration below redirects `/VideoCompareMa` to the trailing-slash address so relative assets resolve correctly. The path is case-sensitive.

## 1. Install nginx

SSH into your Ubuntu server and run:

```bash
sudo apt update
sudo apt install nginx
sudo systemctl enable --now nginx
```

If UFW is enabled, allow HTTP. Keep SSH allowed before enabling a firewall on a remote server:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx HTTP'
sudo ufw status
```

Also allow inbound TCP port 80 in your hosting provider's firewall, if applicable.

## 2. Copy the application

On the server, create the public directory:

```bash
sudo mkdir -p /var/www/VideoCompareMa
```

From your local machine, in the project directory, replace `youruser` and `<serverIP>` and upload the three application files to your SSH user's home directory:

```bash
scp index.html style.css app.js youruser@<serverIP>:~/
```

Back in the server's SSH session, install them with permissions that nginx can read:

```bash
sudo install -m 644 ~/index.html ~/style.css ~/app.js /var/www/VideoCompareMa/
sudo chmod 755 /var/www /var/www/VideoCompareMa
```

Do not copy test fixtures, development scripts, or this guide into the public directory. The app uses relative asset paths and works without modifying its source.

## 3. Configure the nginx server block

If nginx already serves your server IP, add **only the two location blocks** below inside that existing `server { ... }` block. Do not create a second default server. You can inspect the active configuration with `sudo nginx -T`; Ubuntu's stock configuration is usually `/etc/nginx/sites-available/default`.

For a fresh Ubuntu nginx installation, edit that file:

```bash
sudo nano /etc/nginx/sites-available/default
```

Use the following complete server block, replacing `<serverIP>` with the real IP address:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name <serverIP>;

    # Keep your existing root/location configuration here if hosting other apps.
    root /var/www/html;
    index index.html;

    location = /VideoCompareMa {
        return 301 /VideoCompareMa/;
    }

    location ^~ /VideoCompareMa/ {
        # /VideoCompareMa/app.js maps to /var/www/VideoCompareMa/app.js.
        root /var/www;
        index index.html;
        try_files $uri $uri/ =404;
        add_header Cache-Control "no-cache";
        add_header X-Content-Type-Options "nosniff" always;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

The standard `/etc/nginx/nginx.conf` includes `/etc/nginx/mime.types` inside `http { ... }`. Keep that include: it supplies the CSS and JavaScript content types. The `^~` prefix ensures existing regex locations do not accidentally handle the app's assets.

On stock Ubuntu, the default site is already enabled by a symlink in `/etc/nginx/sites-enabled/`. If using a custom site file instead, enable that file there and ensure that only one active server uses `default_server` for port 80.

## 4. Validate and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I http://127.0.0.1/VideoCompareMa
curl -I http://127.0.0.1/VideoCompareMa/
curl -I http://127.0.0.1/VideoCompareMa/app.js
```

Expect a 301 response for the path without a slash and 200 responses for the app and JavaScript. If you have multiple virtual hosts, supply `-H 'Host: <serverIP>'` when testing through localhost.

Open `http://<serverIP>/VideoCompareMa` in a browser. Select two videos and check every view, playback, seeking, and the divider. No `client_max_body_size` change is necessary because files are not uploaded.

## Updates

Repeat the upload and `sudo install` commands with the new three files, then reload the browser. nginx does not need restarting for static file updates. The `no-cache` header allows caching with revalidation, so browsers check for updated files.

## Troubleshooting

- **404:** Check capitalization, `/var/www/VideoCompareMa/index.html`, the active server block, and the `root /var/www;` setting inside the app location.
- **403:** Ensure the directory has execute permission and the files have read permission for nginx. Check `/var/log/nginx/error.log`.
- **Blank page or missing styles:** Check browser developer tools for failed requests and verify the trailing-slash redirect and MIME types.
- **Cannot connect:** Check nginx status, the host firewall, and the provider's firewall. Use `sudo systemctl status nginx`.
- **Video cannot be decoded:** The app supports codecs your browser can decode. MP4 with H.264 video and AAC audio is a practical starting point; WebM support depends on the browser. Renaming an unsupported file to `.mp4` does not convert it.

## Comparison behavior and limits

- Playback starts at time zero for both inputs and ends at the shorter duration. A shared seek changes both times; playback drift above 80 ms is corrected. Browser media elements are not a frame-accurate scientific comparison engine, especially with different frame rates, seeking, or decoder stalls.
- Both frames retain their aspect ratios and are centered in the same comparison area with black padding. Different aspect ratios therefore produce differences in padding regions too.
- Difference mode displays the per-channel absolute difference `abs(A - B)` in browser-decoded RGB. Identical frames appear black. Gain multiplies differences by 1, 2, 4, or 8 and clamps each channel at 255. This is visual comparison, not PSNR/SSIM or an HDR/color-managed measurement. Gain above 1 performs CPU pixel processing and can be slower for large viewports.
- The canvas is rendered at the visible viewport resolution, with device pixel ratio capped at 2. It does not compare native-resolution pixels when videos are scaled.
- The difference view is conceptually inspired by [pixop/video-compare](https://github.com/pixop/video-compare). No source code from that project is included. VideoCompareMa uses browser APIs, so it does not offer the reference tool's FFmpeg codec coverage.

## Local use

Open `index.html` directly in a modern browser. No local development server or dependencies are required.

## GitHub Pages

The repository also includes `.github/workflows/pages.yml`. It deploys only `index.html`, `style.css`, and `app.js` on each push to `main`, or when manually run from the Actions tab. There is no build step or dependency installation.

In the GitHub repository, open **Settings > Pages** and choose **GitHub Actions** as the source. The expected project URL is `https://RmaNMetaverse.github.io/VideoCompareMa/`. Relative asset paths support this subdirectory without changes to the app.

Check **Actions > Deploy GitHub Pages** for deployment progress. The workflow's `github-pages` environment links to the published URL. If configuring this repository for the first time after an earlier failed run, rerun the workflow after enabling Pages. Both GitHub Pages and nginx can serve the same files independently.

See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for the deployment actions and permissions used here.

nginx configuration references: [request routing](https://nginx.org/en/docs/http/request_processing.html), [core directives](https://nginx.org/en/docs/http/ngx_http_core_module.html).
