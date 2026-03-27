import 'package:google_sign_in/google_sign_in.dart';
// Remove any line that says: import 'package:package:ytm_clone/services/google_auth_service.dart';

class GoogleAuthService {
  // Use the CLIENT ID from the "Web Application" type in Google Console
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId: '79361906244-al0q0s3lc37fqn1el1488gjd0u02mrrj.apps.googleusercontent.com',
  );

  Future<void> handleSignIn() async {
    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      
      if (googleUser != null) {
        final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
        final String? idToken = googleAuth.idToken;

        debugPrint("Token obtained: $idToken");
        // Add your logic to send to backend here
      }
    } catch (error) {
      debugPrint("Login Failed: $error");
    }
  }
}
