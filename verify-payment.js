module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("Configuration Error: PAYSTACK_SECRET_KEY is not defined.");
    return res.status(500).json({
      paid: false,
      message: "Server configuration error"
    });
  }

  const reference = req.query.reference;
  if (
    typeof reference !== "string" ||
    !/^[a-zA-Z0-9._=-]{1,100}$/.test(reference.trim())
  ) {
    return res.status(400).json({
      paid: false,
      message: "Invalid payment reference"
    });
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference.trim())}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      return res.status(response.status || 400).json({
        paid: false,
        message: result.message || "Failed to verify transaction"
      });
    }

    const { status, currency, amount, customer } = result.data;

    if (status !== "success" || currency !== "NGN") {
      return res.status(400).json({
        paid: false,
        message: "Payment not confirmed or currency mismatch",
        status
      });
    }

    // Amount returned by Paystack is in kobo (divide by 100 for NGN)
    const amountInKobo = amount;
    const amountInNaira = amount / 100;

    return res.status(200).json({
      paid: true,
      reference: result.data.reference,
      amountKobo: amountInKobo,
      amountNaira: amountInNaira,
      currency,
      customerEmail: customer?.email
    });
  } catch (error) {
    console.error("Paystack verification error:", error);
    return res.status(500).json({
      paid: false,
      message: "Could not verify payment due to internal error"
    });
  }
};
