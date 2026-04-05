import { Link } from "react-router-dom";

export function GoodbyePage() {
  return (
    <div className="animate-page-in flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-light text-gray-800 sm:text-3xl">
        感谢使用
      </h1>
      <p className="mt-4 max-w-md text-gray-600">
        本次学习已结束。你可以关闭本标签页，或返回首页继续探索其它术语。
      </p>
      <Link
        to="/"
        className="mt-10 text-sm text-blue-600 underline-offset-4 transition hover:underline"
      >
        返回首页
      </Link>
    </div>
  );
}
