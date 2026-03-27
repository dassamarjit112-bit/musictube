import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
// FIX: Removed 'package:' prefix and the accidental space before 'services'
import 'package:ytm_clone/services/google_auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // STABLE SERVER FIX FOR VITE
  try {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 8080);
    server.listen((HttpRequest request) async {
      try {
        String path = request.uri.path == '/' ? 'index.html' : request.uri.path;
        if (path.startsWith('/')) path = path.substring(1);
        
        final byteData = await rootBundle.load('assets/www/$path');
        final bytes = byteData.buffer.asUint8List();
        
        if (path.endsWith('.html')) request.response.headers.contentType = ContentType.html;
        else if (path.endsWith('.js')) request.response.headers.contentType = ContentType('application', 'javascript', charset: 'utf-8');
        else if (path.endsWith('.css')) request.response.headers.contentType = ContentType('text', 'css', charset: 'utf-8');
        
        request.response.add(bytes);
      } catch (e) {
        request.response.statusCode = HttpStatus.notFound;
      }
      await request.response.close();
    });
  } catch (e) {
    debugPrint("Server Error: $e");
  }

  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: YTMApp(),
  ));
}

class YTMApp extends StatefulWidget {
  const YTMApp({super.key});
  @override
  State<YTMApp> createState() => _YTMAppState();
}

class _YTMAppState extends State<YTMApp> {
  final GoogleAuthService _authService = GoogleAuthService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            // Your WebView Layer
            InAppWebView(
              initialUrlRequest: URLRequest(
                url: WebUri("http://localhost:8080/index.html"), 
              ),
              initialSettings: InAppWebViewSettings(
                mediaPlaybackRequiresUserGesture: false,
                allowsInlineMediaPlayback: true,
                javaScriptEnabled: true,
                domStorageEnabled: true,
              ),
            ),
            
            // Floating Auth Button so it doesn't block the WebView
            Positioned(
              bottom: 20,
              right: 20,
              child: ElevatedButton(
                onPressed: () async {
                  await _authService.handleSignIn();
                },
                child: const Text("Sign in with Google"),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
