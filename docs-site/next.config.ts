import nextra from "nextra";

const withNextra = nextra({
  defaultShowCopyCode: true,
});

const nextConfig = {
  reactStrictMode: true,
};

export default withNextra(nextConfig);
