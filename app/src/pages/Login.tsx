import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";

function getReturnTo() {
  const target = new URLSearchParams(window.location.search).get("returnTo");
  if (target && target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/api/")) {
    return target;
  }
  return "/";
}

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}${import.meta.env.BASE_URL}api/oauth/callback`;
  const state = btoa(JSON.stringify({ redirectUri, returnTo: getReturnTo() }));

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const localDemo = trpc.auth.localDemo.useMutation({
    onSuccess: () => {
      window.location.replace(getReturnTo());
    },
    onError: (error) => toast.error("本机试玩登录失败", { description: error.message }),
  });

  const startCloudLogin = () => {
    const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
    const appID = import.meta.env.VITE_APP_ID;
    if (!kimiAuthUrl || !appID || appID === "local-dev" || appID === "tdg-cloud") {
      toast.error("云登录客户端未配置", {
        description: "当前 APP_ID 还是占位值 local-dev，请先配置已登记的 Kimi OAuth 客户端 ID。",
      });
      return;
    }
    window.location.href = getOAuthUrl();
  };

  const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
  const oauthErrorDescription = new URLSearchParams(window.location.search).get("oauth_error_description");

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          {oauthError && (
            <div className="mb-4 rounded-lg border border-suit-heart/30 bg-suit-heart/5 px-3 py-2 text-[12px] leading-5 text-suit-heart">
              云登录没有完成：{oauthErrorDescription || oauthError}。可以先使用下面的本机试玩进入当前房间。
            </div>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={startCloudLogin}
          >
            Sign in with Kimi
          </Button>
          {import.meta.env.DEV && (
            <Button
              className="mt-3 w-full"
              variant="outline"
              size="lg"
              disabled={localDemo.isPending}
              onClick={() => localDemo.mutate({ name: "本机赛马旅人" })}
            >
              {localDemo.isPending ? "正在进入本机试玩…" : "本机试玩（跳过云登录）"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
