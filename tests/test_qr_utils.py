import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from qr_utils import *  # noqa


class UtilsTest(unittest.TestCase):
    def test_social(self):
        self.assertEqual(normalize_social("instagram", "@dijitalgru"), "https://instagram.com/dijitalgru")
        self.assertEqual(normalize_social("instagram", "dijitalgru"), "https://instagram.com/dijitalgru")
        self.assertEqual(normalize_social("instagram", "instagram.com/dijitalgru"), "https://instagram.com/dijitalgru")
        self.assertEqual(normalize_social("instagram", "https://instagram.com/x"), "https://instagram.com/x")
        self.assertEqual(normalize_social("instagram", "https://dijitalgru"), "https://instagram.com/dijitalgru")
        self.assertEqual(normalize_social("facebook", "sayfa"), "https://facebook.com/sayfa")
        self.assertEqual(normalize_social("pinterest", "@p"), "https://pinterest.com/p")
        self.assertEqual(normalize_social("linkedin", "ali-veli"), "https://linkedin.com/in/ali-veli")
        self.assertEqual(normalize_social("linkedin", "company/acme"), "https://linkedin.com/company/acme")
        self.assertEqual(normalize_social("linkedin", "linkedin.com/company/acme"), "https://linkedin.com/company/acme")
        self.assertEqual(normalize_social("twitter", "@a"), "https://x.com/a")
        self.assertEqual(normalize_social("tiktok", "@a"), "https://tiktok.com/@a")
        self.assertEqual(normalize_social("youtube", "kanal"), "https://youtube.com/@kanal")
        self.assertEqual(normalize_social("instagram", "javascript:alert(1)"), "")
        self.assertEqual(normalize_social("instagram", ""), "")

    def test_wa(self):
        for raw in ("+90 537 627 44 15", "0537 627 44 15", "5376274415", "905376274415", "(0537) 627-44-15"):
            self.assertEqual(normalize_phone_for_wa(raw), "905376274415", raw)
        self.assertTrue(is_valid_wa_number("905376274415"))
        self.assertFalse(is_valid_wa_number("90537"))
        self.assertEqual(build_whatsapp_url("+90 537 627 44 15", "Merhaba dünya"),
                         "https://wa.me/905376274415?text=Merhaba%20d%C3%BCnya")
        p, m = parse_whatsapp_target("https://wa.me/+90 537 627 44 15?text=Merhaba%20d")
        self.assertEqual(normalize_phone_for_wa(p), "905376274415")
        self.assertEqual(m, "Merhaba d")

    def test_e164(self):
        self.assertEqual(normalize_phone_e164("+90 (537) 627-44-15"), "+905376274415")
        self.assertEqual(normalize_phone_e164("0537 627 44 15"), "+905376274415")
        self.assertEqual(normalize_phone_e164("+44 20 7946 0958"), "+442079460958")

    def test_url(self):
        self.assertFalse(validate_url("")[0])
        self.assertFalse(validate_url("javascript:alert(1)")[0])
        self.assertFalse(validate_url("https://javascript:alert(1)")[0])
        self.assertFalse(validate_url("data:text/html,x")[0])
        self.assertFalse(validate_url("vbscript:x")[0])
        self.assertFalse(validate_url("ftp://a.com")[0])
        self.assertFalse(validate_url("localhost")[0])
        self.assertFalse(validate_url("https://abc")[0])
        self.assertEqual(validate_url("siteniz.com/x")[1], "https://siteniz.com/x")
        self.assertEqual(validate_url("http://a.b.co/p?q=1")[1], "http://a.b.co/p?q=1")
        self.assertTrue(validate_url("https://türkçe-site.com")[0])

    def test_static(self):
        c, e = build_static_target("phone", {"phone": "+90 (537) 627-44-15"})
        self.assertEqual(c, "tel:+905376274415"); self.assertFalse(e)
        c, e = build_static_target("sms", {"phone": "0537 627 44 15", "message": "Selam"})
        self.assertEqual(c, "SMSTO:+905376274415:Selam"); self.assertFalse(e)
        c, e = build_static_target("wifi", {"ssid": 'Ev;"Ağ', "password": "pa:ss,w\\rd1", "encryption": "WPA", "hidden": False})
        self.assertEqual(c, 'WIFI:T:WPA;S:Ev\\;\\"Ağ;P:pa\\:ss\\,w\\\\rd1;H:false;;')
        d = parse_wifi(c)
        self.assertEqual((d["ssid"], d["password"]), ('Ev;"Ağ', "pa:ss,w\\rd1"))
        c, e = build_static_target("wifi", {"ssid": "A", "password": "", "encryption": "nopass"})
        self.assertEqual(c, "WIFI:T:nopass;S:A;H:false;;"); self.assertFalse(e)
        _, e = build_static_target("wifi", {"ssid": "", "password": "", "encryption": "WPA"})
        self.assertIn("ssid", e)
        _, e = build_static_target("text", {"text": " "})
        self.assertIn("text", e)
        # legacy
        self.assertEqual(static_content_for("phone", "+90 537 627 44 15"), "tel:+905376274415")
        self.assertEqual(static_content_for("wifi", "WIFI:S:Ag;T:WPA;P:12345678;;"), "WIFI:T:WPA;S:Ag;P:12345678;H:false;;")
        self.assertEqual(parse_sms("Merhaba"), {"phone": "", "message": "Merhaba"})
        self.assertEqual(parse_sms("SMSTO:+90537:Hi: there")["message"], "Hi: there")

    def test_misc(self):
        self.assertEqual(mask_ip("85.12.34.56"), "85.12.34.0")
        self.assertTrue(is_bot_request("WhatsApp/2.23", "GET"))
        self.assertTrue(is_bot_request("Mozilla/5.0 iPhone", "HEAD"))
        self.assertFalse(is_bot_request("Mozilla/5.0 (iPhone; CPU iPhone OS 17) AppleWebKit Safari", "GET"))
        self.assertEqual(fmt_istanbul(1763380800), "2025-11-17 15:00:00")


if __name__ == "__main__":
    unittest.main()
