const retailerNames: Record<string, string> = {
  home_depot_ca: "Home Depot",
  amazon_ca: "Amazon",
};

export function publicRetailerError(retailerId: string, error: unknown) {
  const retailer = retailerNames[retailerId] ?? "The retailer";
  const diagnostic = error instanceof Error ? error.message : String(error);

  if (/captcha|access challenge|access denied|verify you are human/i.test(diagnostic)) {
    return { retailerId, message: `${retailer} requires verification right now` };
  }
  if (/timeout|timed out/i.test(diagnostic)) {
    return { retailerId, message: `${retailer} did not respond in time` };
  }
  return { retailerId, message: `${retailer} live results are temporarily unavailable` };
}
