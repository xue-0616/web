// Recovered from dist/email.templat.js.map (source: ../../../src/shared/utils/email.templat.ts)

export function unipassCodeTemplate(body: string): string {
    const html = `<!DOCTYPE html>

<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml">

<head>
	<title></title>
	<meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
	<meta content="width=device-width, initial-scale=1.0" name="viewport" />
	<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 0;
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: inherit !important;
		}

		#MessageViewBody a {
			color: inherit;
			text-decoration: none;
		}

		p {
			line-height: inherit
		}

		.desktop_hide,
		.desktop_hide table {
			mso-hide: all;
			display: none;
			max-height: 0px;
			overflow: hidden;
		}

		@media (max-width:670px) {
			.desktop_hide table.icons-inner {
				display: inline-block !important;
			}

			.icons-inner {
				text-align: center;
			}

			.icons-inner td {
				margin: 0 auto;
			}

			.row-content {
				width: 100% !important;
			}

			td.content_blocks {
				width: auto !important;
			}

			.column .border,
			.mobile_hide {
				display: none;
			}

			table {
				table-layout: fixed !important;
			}

			.stack .column {
				width: 100%;
				display: block;
			}

			.mobile_hide {
				min-height: 0;
				max-height: 0;
				max-width: 0;
				overflow: hidden;
				font-size: 0px;
			}

			.desktop_hide,
			.desktop_hide table {
				display: table !important;
				max-height: none !important;
			}

			.row-4 .column-1 {
				border-right: 30px solid #FFFFFF;
				border-left: 30px solid #FFFFFF;
			}
		}
	</style>
</head>

<body style="background-color: #f8f8f9; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table border="0" cellpadding="0" cellspacing="0" class="nl-container" role="presentation"
		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f8f8f9;" width="100%">
		<tbody>
			<tr>
				<td>

					<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-2"
						role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
						<tbody>
							<tr>
								<td>
									<table align="center" border="0" cellpadding="0" cellspacing="0"
										class="row-content stack" role="presentation"
										style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f8f8f9; color: #000000; width: 650px;"
										width="650">
										<tbody>
											<tr>
												<td class="column column-1"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; padding-top: 5px; padding-bottom: 5px; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
													width="100%">
													<table border="0" cellpadding="20" cellspacing="0"
														class="divider_block" role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
														width="100%">
														<tr>
															<td>
																<div align="center">
																	<table border="0" cellpadding="0" cellspacing="0"
																		role="presentation"
																		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
																		width="100%">
																		<tr>
																			<td class="divider_inner"
																				style="font-size: 1px; line-height: 1px; border-top: 0px solid #BBBBBB;">
																				<span> </span></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					
					<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-3"
						role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
						<tbody>
							<tr>
								<td>
									<table align="center" border="0" cellpadding="0" cellspacing="0"
										class="row-content stack" role="presentation"
										style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fff; color: #000000; width: 650px;"
										width="650">
										<tbody>
											<tr>
												<td class="column column-1"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; padding-top: 0px; padding-bottom: 0px; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
													width="100%">
													<table border="0" cellpadding="0" cellspacing="0"
														class="divider_block" role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
														width="100%">
														<tr>
															<td style="padding-bottom:12px;padding-top:40px;">
																<div align="center">
																	<table border="0" cellpadding="0" cellspacing="0"
																		role="presentation"
																		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
																		width="0%">
																		<tr>
																			<td class="divider_inner"
																				style="font-size: 1px; line-height: 1px; border-top: 0px solid #BBBBBB;">
																				<span> </span></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
													
													<div
													class="mj-column-per-100 outlook-group-fix"
													style="font-size:13px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
												  >
													<table
													  border="0"
													  cellpadding="0"
													  cellspacing="0"
													  role="presentation"
													  style="vertical-align:top;"
													  width="100%"
													>
													  <tr>
														<td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
														  <table
															border="0"
															cellpadding="0"
															cellspacing="0"
															role="presentation"
															style="border-collapse:collapse;border-spacing:0px;"
														  >
															<tbody>
															  <tr>
																<td style="width:120px;">
																  <a target="_blank">
																	<img
																	  height="auto"
																	  src="https://s2.loli.net/2022/11/09/JlauhgiNWd43SbA.png"
																	  style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;"
																	/>
																  </a>
																</td>
															  </tr>
															</tbody>
														  </table>
														</td>
													  </tr>
													</table>
												  </div>
								  
													<table border="0" cellpadding="0" cellspacing="0" class="text_block"
														role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
														width="100%">
														<tr>
															<td
																style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:10px;">
																<div style="font-family: sans-serif">
																	<div class="txtTinyMce-wrapper"
																		style="font-size: 12px; mso-line-height-alt: 14.399999999999999px; color: #555555; line-height: 1.2; font-family: Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;">
																		<p
																			style="margin: 0; font-size: 16px; text-align: center;">
																			<span
																				style="color:#2b303a;font-size:28px;"><span
																					style=""><strong>Email
																						Verification
																						Code</strong></span></span></p>
																	</div>
																</div>
															</td>
														</tr>
													</table>
													<table border="0" cellpadding="0" cellspacing="0" class="text_block"
														role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
														width="100%">
														<tr>
															<td
																style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:10px;">
																<div style="font-family: sans-serif">
																	<div class="txtTinyMce-wrapper"
																		style="font-size: 12px; font-family: Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif; mso-line-height-alt: 18px; color: #555555; line-height: 1.5;">
																		<p
																			style="margin: 0; font-size: 14px; text-align: center;">
																			<span style="color:#808389;"><span
																					style="font-size:15px;">In order to
																					verify this email, please enter the
																					6-digit verification
																					code:</span></span></p>
																	</div>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-4"
						role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
						<tbody>
							<tr>
								<td>
									<table align="center" border="0" cellpadding="0" cellspacing="0"
										class="row-content stack" role="presentation"
										style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #F8F7FE; color: #000000; width: 650px;"
										width="650">
										<tbody>
											<tr>
												<td class="column column-1"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;"
													width="100%">
													<table border="0" cellpadding="0" cellspacing="0"
														role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
														width="100%">
														<tr>
															<td class="border"
																style="width:30px;background-color:#FFFFFF"> </td>
															<td class="content_blocks"
																style="padding-top:0px;padding-bottom:0px;border-top:0px;border-bottom:0px;width:590px;">
																<table border="0" cellpadding="0" cellspacing="0"
																	class="divider_block" role="presentation"
																	style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
																	width="100%">
																	<tr>
																		<td>
																			<div align="center">
																				<table border="0" cellpadding="0"
																					cellspacing="0" role="presentation"
																					style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
																					width="100%">
																					<tr>
																						<td class="divider_inner"
																							style="font-size: 1px; line-height: 1px; border-top: 4px solid #8864FF;">
																							<span> </span></td>
																					</tr>
																				</table>
																			</div>
																		</td>
																	</tr>
																</table>
																<table border="0" cellpadding="0" cellspacing="0"
																	class="divider_block" role="presentation"
																	style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
																	width="100%">
																	<tr>
																		<td style="padding-top:25px;">
																			<div align="center">
																				<table border="0" cellpadding="0"
																					cellspacing="0" role="presentation"
																					style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
																					width="100%">
																					<tr>
																						<td class="divider_inner"
																							style="font-size: 1px; line-height: 1px; border-top: 0px solid #BBBBBB;">
																							<span> </span></td>
																					</tr>
																				</table>
																			</div>
																		</td>
																	</tr>
																</table>
																<table border="0" cellpadding="0" cellspacing="0"
																	class="text_block" role="presentation"
																	style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
																	width="100%">
																	<tr>
																		<td
																			style="padding-bottom:15px;padding-left:10px;padding-right:10px;padding-top:0px;">
																			<div style="font-family: sans-serif">
																				<div class="txtTinyMce-wrapper"
																					style="font-size: 12px; mso-line-height-alt: 14.399999999999999px; color: #555555; line-height: 1.2; font-family: Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;">
																					<p
																						style="margin: 0; font-size: 16px; text-align: center;">
																						<span
																							style="color:#2b303a;font-size:20px;"><strong>Verification
																								Code</strong></span></p>
																				</div>
																			</div>
																		</td>
																	</tr>
																</table>
																<table border="0" cellpadding="0" cellspacing="0"
																	class="text_block" role="presentation"
																	style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
																	width="100%">
																	<tr>
																		<td style="padding-bottom:32px;">
																			<div style="font-family: sans-serif">
																				<div class="txtTinyMce-wrapper"
																					style="font-size: 12px; mso-line-height-alt: 14.399999999999999px; color: #555555; line-height: 1.2; font-family: Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif;">
																					<p
																						style="margin: 0; font-size: 16px; text-align: center;">
																						<span
																							style="color:#8864FF;font-size:24px;"><span
																								style=""><strong>${body}</strong></span></span>
																					</p>
																				</div>
																			</div>
																		</td>
																	</tr>
																</table>
															</td>
															<td class="border"
																style="width:30px;background-color:#FFFFFF"> </td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-5"
						role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;" width="100%">
						<tbody>
							<tr>
								<td>
									<table align="center" border="0" cellpadding="0" cellspacing="0"
										class="row-content stack" role="presentation"
										style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fff; color: #000000; width: 650px;"
										width="650">
										<tbody>
											<tr>
												<td class="column column-1"
													style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; padding-top: 0px; padding-bottom: 0px; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;"
													width="100%">
													<table border="0" cellpadding="0" cellspacing="0" class="text_block"
														role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;"
														width="100%">
														<tr>
															<td
																style="padding-bottom:10px;padding-left:40px;padding-right:40px;padding-top:10px;">
																<div style="font-family: sans-serif">
																	<div class="txtTinyMce-wrapper"
																		style="font-size: 12px; font-family: Montserrat, Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, Tahoma, sans-serif; mso-line-height-alt: 18px; color: #555555; line-height: 1.5;">
																		<p
																			style="margin: 0; font-size: 14px; text-align: center;">
																			<span style="color:#808389;"><span
																					style="font-size:15px;">This
																					verification code will expire in 30
																					mins, please verify as soon as
																					possible.</span></span></p>
																		<p
																			style="margin: 0; font-size: 14px; text-align: center;">
																			<span style="color:#808389;"><span
																					style="font-size:15px;">If you did
																					not request this email, please
																					ignore it!</span></span></p>
																	</div>
																</div>
															</td>
														</tr>
													</table>
													<table border="0" cellpadding="0" cellspacing="0"
														class="divider_block" role="presentation"
														style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
														width="100%">
														<tr>
															<td style="padding-bottom:12px;padding-top:60px;">
																<div align="center">
																	<table border="0" cellpadding="0" cellspacing="0"
																		role="presentation"
																		style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;"
																		width="100%">
																		<tr>
																			<td class="divider_inner"
																				style="font-size: 1px; line-height: 1px; border-top: 0px solid #BBBBBB;">
																				<span> </span></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>

				</td>
			</tr>
		</tbody>
	</table><!-- End -->
</body>

</html>`;
    return html;
}

export function cassaveCodeTemplate(body: string): string {
    const html = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cassava</title>
    <style>
        * {
            padding: 0;
            margin: 0;
        }

        img {
            display: block;
        }

        body {
            background-color: #D9D9D9;
            width: 100vw;
            height: 100vh;
            font-family: 'Arial';
        }

        .cassava_filler_bottom {
            height: 5px;
            background-image: url("//cdn.cassava.network/public/emails/backgound_bottom.png");
            background-repeat: repeat;
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
        }

        .cassava_view {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 680px;
            display: flex;
            align-items: center;
            flex-direction: column;
        }

        .cassava_logo_text {
            width: 260px;
        }

        .cassava_email {
            background: #fff;
            padding: 24px 32px;
            width: 100%;
            margin-top: 24px;
        }

        .cassava_text_1 {
            font-size: 20px;
        }

        .cassava_text_2 {
            font-size: 16px;
        }

        .cassava_text_3 {
            font-size: 12px;
            color: #666666;
        }

        .casava_code {
            color: #3E9210;
            font-weight: 700;
            font-size: 20px;
        }

        .cassava_link {
            color: #3E9210;
            text-decoration: underline;
        }

        .filler_line {
            width: 100%;
            height: 1px;
            background-color: #E1E1E1;
        }

        .cassava_list {
            line-height: 16px;
            margin-top: 8px;
            padding-left: 15px;
        }

        .cassava_social {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        }

        .cassava_social_logo_text {
            width: 160px;
            height: 21px;
        }

        .cassava_social_other {
            display: flex;
            gap: 32px;
        }

        .cassava_social_other img {
            width: 30px;
            height: 30px;
            cursor: pointer;
        }

        .filler_mg_16 {
            margin: 16px 0;
        }

        .filler_mg_24 {
            margin: 24px 0;
        }

        .mg_b_32 {
            margin-bottom: 32px;
        }

        .mg_b_12 {
            margin-bottom: 12px;
        }
    </style>
</head>

<body>
    <div class="cassava_view">
        <img src="https://cdn.cassava.network/public/emails/icon_logo_with_text.png" alt="logo_cassava" class="cassava_logo_text">
        <div class="cassava_email">
            <div class="cassava_text_1">Verification code</div>
            <div class="filler_line filler_mg_24"></div>
            <div class="cassava_text_3 mg_b_32">In order to verify for CASSAVA, please enter the 6-digit verification
                code:</div>
            <div class="mg_b_12 cassava_text_2">Verification code</div>
            <div class="casava_code mg_b_32">${body}</div>
            <div class="cassava_text_3">This verification code will expire in 30 minutes, please enter it as soon as
                possible.</div>
            <div class="filler_line filler_mg_16"></div>
            <div class="cassava_text_1">
                Thank you for registering CASSAVA.
            </div>
            <ul class="mg_t_8 cassava_list">
                <li class="cassava_text_3">Do not disclose the verification code to others.</li>
                <li class="cassava_text_3">If this is not you, please contact customer support immediately at
                    <a href="mailto:contact@cassava.network" type="email"
                        class="cassava_link">contact@cassava.network</a>
                </li>
                <li class="cassava_text_3">To protect the security of your account, please do not forward this email.
                </li>
                <li class="cassava_text_3">This is an automated email, please do not reply.</li>
            </ul>
        </div>
        <div class="cassava_social">
            <img src="https://cdn.cassava.network/public/emails/icon_logo_with_text.png" alt="logo_with_text" class="cassava_social_logo_text">
            <div class="cassava_social_other">
                <a href="https://app.cassava.network" target="_blank">
                    <img src="https://cdn.cassava.network/public/emails/icon_logo.png" alt="cassava">
                </a>
                <a href="https://discord.com/invite/VCqXwYV5au" target="_blank">
                    <img src="https://cdn.cassava.network/public/emails/icon_discord.png" alt="discord">
                </a>
                <a href="https://twitter.com/CassavaNetwork" target="_blank">
                    <img src="https://cdn.cassava.network/public/emails/icon_twitter.png" alt="twitter">
                </a>
            </div>
        </div>
    </div>
    <div class="cassava_filler_bottom"></div>
    <script>
    </script>
</body>

</html>`;
    return html;
}
