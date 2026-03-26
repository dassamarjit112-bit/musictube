import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MaterialApp(home: YTMApp()));
}

class YTMApp extends StatefulWidget {
  const YTMApp({super.key});
  @override
  State<YTMApp> createState() => _YTMAppState();
}

class _YTMAppState extends State<YTMApp> {
  InAppWebViewController? webViewController;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: InAppWebView(
          initialUrlRequest: URLRequest(
            url: WebUri("file:///android_asset/flutter_assets/assets/www/index.html"), 
          ),
          initialSettings: InAppWebViewSettings(
            mediaPlaybackRequiresUserGesture: false,
            allowsInlineMediaPlayback: true,
            iframeAllow: "autoplay",
            iframeAllowFullscreen: true,
            useOnLoadResource: true,
            cacheEnabled: true,
            domStorageEnabled: true,
            transparentBackground: true,
            // Android-specific settings
            safeBrowsingEnabled: true,
            allowFileAccessFromFileURLs: true,
            allowUniversalAccessFromFileURLs: true,
            mixedContentMode: MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
          ),
          onWebViewCreated: (controller) {
            webViewController = controller;
          },
        ),
      ),
    );
  }
}
